import json
import os
import subprocess
import time
import urllib2
from datetime import datetime

import requests
from dateutil import parser
from dateutil.tz import tzlocal
from libpebble2.communication.transports.websocket import MessageTargetPhone
from libpebble2.communication.transports.websocket.protocol import AppConfigResponse
from libpebble2.communication.transports.websocket.protocol import AppConfigSetup
from libpebble2.communication.transports.websocket.protocol import WebSocketPhonesimAppConfig
from pebble_tool.sdk.emulator import ManagedEmulatorTransport

PLATFORMS = ('aplite', 'basalt')
PORT = os.environ.get('MOCK_SERVER_PORT', 5555)
MOCK_HOST = 'http://localhost:{}'.format(PORT)

CONSTANTS = json.loads(
    open(os.path.join(os.path.dirname(__file__), '../src/js/constants.json')).read()
)
BASE_CONFIG = CONSTANTS['DEFAULT_CONFIG']

def post_mock_server(url, data):
    requests.post(MOCK_HOST + url, data=json.dumps(data))

def pebble_install_and_run(platforms):
    _call('pebble kill')
    _call('pebble clean')
    # TODO ensure this is called from the main project directory
    _call('pebble build')
    for platform in platforms:
        _call('pebble install --emulator {}'.format(platform))
    # Give the watchface time to show up
    time.sleep(10)

def pebble_reinstall(platforms):
    _call('pebble kill')
    _call('pebble wipe')
    for platform in platforms:
        _call('pebble install --emulator {}'.format(platform))
    time.sleep(10)

def set_config(config, platforms):
    for platform in platforms:
        emu = ManagedEmulatorTransport(platform)
        emu.connect()
        time.sleep(0.5)
        emu.send_packet(WebSocketPhonesimAppConfig(
            config=AppConfigSetup()),
            target=MessageTargetPhone()
        )
        time.sleep(0.5)
        emu.send_packet(WebSocketPhonesimAppConfig(
            config=AppConfigResponse(data=urllib2.quote(json.dumps(config)))),
            target=MessageTargetPhone()
        )
    # Wait for the watchface to re-render and request data
    time.sleep(0.5)

def pebble_screenshot(filename, platform):
    _call('pebble screenshot --emulator {} --no-open {}'.format(platform, filename))

def _call(command_str, **kwargs):
    print command_str
    return subprocess.Popen(
        command_str.split(' '),
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        **kwargs
    ).communicate()

def ensure_empty_dir(dirname):
    if os.path.isdir(dirname):
        _, err = _call('rm -r {}'.format(dirname))
        if err != '':
            raise Exception(err)
    os.mkdir(dirname)

def image_diff(test_file, gold_file, out_file):
    # requires ImageMagick
    _, diff = _call('compare -metric AE {} {} {}'.format(test_file, gold_file, out_file))
    return diff == '0'


class ScreenshotTest(object):
    @staticmethod
    def out_dir():
        return os.path.join(os.path.dirname(__file__), 'output')

    @classmethod
    def summary_filename(cls):
        return os.path.join(cls.out_dir(), 'screenshots.html')

    def circleci_url(self):
        if os.environ.get('CIRCLECI'):
            return 'https://circleci.com/api/v1/project/{}/{}/{}/artifacts/{}/$CIRCLE_ARTIFACTS/{}'.format(
                os.environ['CIRCLE_PROJECT_USERNAME'],
                os.environ['CIRCLE_PROJECT_REPONAME'],
                os.environ['CIRCLE_BUILD_NUM'],
                os.environ['CIRCLE_NODE_INDEX'],
                os.path.relpath(self.summary_filename(), os.path.dirname(__file__)),
            )
        else:
            return None

    @classmethod
    def test_filename(cls, platform):
        return os.path.join(cls.out_dir(), 'img', '{}-{}.png'.format(cls.__name__, platform))

    @classmethod
    def gold_filename(cls, platform):
        return os.path.join(os.path.dirname(__file__), 'gold', '{}-{}.png'.format(cls.__name__, platform))

    @classmethod
    def diff_filename(cls, platform):
        return os.path.join(cls.out_dir(), 'diff', '{}-{}.png'.format(cls.__name__, platform))


    @classmethod
    def ensure_environment(cls):
        if not hasattr(ScreenshotTest, '_loaded_environment'):
            ScreenshotTest.test_count = 0
            pebble_install_and_run(PLATFORMS)
            ensure_empty_dir(cls.out_dir())
            os.mkdir(os.path.join(cls.out_dir(), 'img'))
            os.mkdir(os.path.join(cls.out_dir(), 'diff'))
            ScreenshotTest.summary_file = SummaryFile(cls.summary_filename(), BASE_CONFIG)
            ScreenshotTest._loaded_environment = True
        else:
            ScreenshotTest.test_count += 1
            # The Pebble emulator gets flaky after a while
            if ScreenshotTest.test_count % 10 == 0:
                pebble_reinstall(PLATFORMS)

    def sgvs(self):
        raise NotImplementedError

    def treatments(self):
        return []

    def profile(self):
        return []

    def devicestatus(self):
        return []

    def test_screenshot(self):
        if not hasattr(self, 'config'):
            self.config = {}

        # Create the SGVs at test run time, not at test definition time.
        # Otherwise, recency display in the screenshots can differ across runs.
        if not hasattr(self.sgvs, '__call__'):
            raise "sgvs attribute of test instance must be callable"

        self.ensure_environment()

        # XXX this should all be run in a single process, e.g. with Tornado
        self.test_sgvs = self.sgvs()
        post_mock_server('/set-sgv', self.test_sgvs)

        self.test_treatments = self.treatments()
        post_mock_server('/set-treatments', self.test_treatments)

        self.test_profile = self.profile()
        post_mock_server('/set-profile', self.test_profile)

        self.test_devicestatus = self.devicestatus()
        post_mock_server('/set-devicestatus', self.test_devicestatus)

        set_config(dict(BASE_CONFIG, nightscout_url=MOCK_HOST, __CLEAR_CACHE__=True, **self.config), PLATFORMS)

        fails = []
        for platform in PLATFORMS:
            pebble_screenshot(self.test_filename(platform), platform)

            try:
                os.stat(self.gold_filename(platform))
            except OSError:
                images_match = False
                reason = 'Test is missing "gold" image: {}'.format(self.gold_filename(platform))
            else:
                images_match = image_diff(self.test_filename(platform), self.gold_filename(platform), self.diff_filename(platform))
                reason = 'Screenshot does not match expected: "{}"'.format(self.__class__.__doc__)
                reason += '\n' + self.circleci_url() if self.circleci_url() else ''

            ScreenshotTest.summary_file.add_test_result(self, platform, images_match)
            if not images_match:
                fails.append((platform, reason))

        assert fails == [], '\n'.join(['{}: {}'.format(p, reason) for p, reason in fails])


class SummaryFile(object):
    """Generate summary file with screenshots, in a very janky way for now."""
    def __init__(self, out_file, base_config):
        self.out_file = out_file
        self.base_config = base_config
        self.fails = ''
        self.passes = ''

    def write(self):
        with open(self.out_file, 'w') as f:
            f.write("""
            <head>
              <style>
                td { border: 1px solid #666; padding: 4px; vertical-align: top; }
                table { border-collapse: collapse; margin-bottom: 2em; }
                img.pass { border: 5px solid #aea; }
                img.fail { border: 5px solid red; }
                code { display: block; border-top: 1px solid #999; margin-top: 0.5em; padding-top: 0.5em; }
              </style>
            </head>
            <body>
            """
            +
            """
              <table>
                {fails}
              </table>
              <table>
                {passes}
              </table>
            """.format(fails=self.fails, passes=self.passes))

            f.write("""
            <strong>Default config</strong> (each test's config is merged into this):
            <br>
            <code>{}</code>
            """.format(json.dumps(self.base_config)))

    def add_test_result(self, test_instance, platform, passed):
        details = """
            <strong>{classname} [{platform}]</strong> {doc}
            <code>{config}</code>
            <code>{sgvs}</code>
        """.format(
            classname=test_instance.__class__.__name__,
            platform=platform,
            doc=test_instance.__class__.__doc__ or '',
            config=json.dumps(test_instance.config),
            sgvs=json.dumps(self.formatted_sgvs(test_instance.test_sgvs))
        )
        if test_instance.test_treatments:
            details += "<code>{treatments}</code>".format(treatments=self.format_created_at(test_instance.test_treatments))
        if test_instance.test_profile:
            details += "<code>{profile}</code>".format(profile=test_instance.test_profile)
        if test_instance.test_devicestatus:
            details += "<code>{devicestatus}</code>".format(devicestatus=self.format_created_at(test_instance.test_devicestatus))
        result = """
        <tr>
          <td><img src="{test_filename}" class="{klass}"></td>
          <td><img src="{diff_filename}"></td>
          <td>{details}</td>
        </tr>
        """.format(
            test_filename=self.relative_path(test_instance.test_filename(platform)),
            klass=('pass' if passed else 'fail'),
            diff_filename=self.relative_path(test_instance.diff_filename(platform)),
            details=details,
        )
        if passed:
            self.passes += result
        else:
            self.fails += result
        self.write()

    def relative_path(self, filename):
        return os.path.relpath(filename, os.path.dirname(self.out_file))

    def formatted_sgvs(self, sgvs):
        return [
            s
            if i == 0
            else {
                'sgv': s.get('sgv'),
                'ago': self.format_ago(datetime.fromtimestamp(s['date'] / 1000).replace(tzinfo=tzlocal())),
            }
            for i, s in enumerate(sgvs)
        ]

    def format_created_at(self, entries):
        out = []
        for e in [_e.copy() for _e in entries]:
            e['ago'] = self.format_ago(parser.parse(e['created_at']))
            del e['created_at']
            out.append(e)
        return out

    @staticmethod
    def format_ago(time):
        minutes = int((datetime.now().replace(tzinfo=tzlocal()) - time).total_seconds() / 60)
        if minutes < 60:
            return '{}m'.format(minutes)
        else:
            return '{}h{}m'.format(minutes / 60, minutes % 60)
