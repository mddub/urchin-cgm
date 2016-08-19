"""
Send the `config` dict from a test class definition to the emulator.
Best run with `watchdog` or similar to monitor file changes.
"""

import argparse
import os
import sys

import test_screenshots
from util import set_config

PORT = os.environ.get('MOCK_SERVER_PORT')

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('test_class', help='name of test class (e.g. TestLayoutD)')
parser.add_argument('--platform', default='basalt', help='which emulator')
args = parser.parse_args()

config = getattr(test_screenshots, args.test_class)().config
config['__CLEAR_CACHE__'] = True
if PORT:
    config['nightscout_url'] = 'http://localhost:{}'.format(PORT)
set_config(config, [args.platform])
