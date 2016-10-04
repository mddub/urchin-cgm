"""
Send Urchin config to the Pebble emulator, either from the `config` dict in a
test class definition or from a JSON string. For the former case, best run with
`watchdog` or similar to monitor file changes.
"""

import argparse
import json
import os
import sys

import test_screenshots
from util import set_config

PORT = os.environ.get('MOCK_SERVER_PORT')

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('--test-class', help='name of test class (e.g. TestLayoutD)')
parser.add_argument('--config-json', help='JSON config string to set')
parser.add_argument('--platform', default='basalt', help='which emulator')
args = parser.parse_args()

if args.test_class:
    config = getattr(test_screenshots, args.test_class)().config
elif args.config_json:
    config = json.loads(args.config_json)
else:
    print "Must specify either --test-class or --config-json"
    sys.exit(1)
config['__CLEAR_CACHE__'] = True

if PORT:
    config['nightscout_url'] = 'http://localhost:{}'.format(PORT)

set_config(config, [args.platform])
