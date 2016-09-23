"""
Mock Nightscout server. Two modes for data source:
1. the values received in a POST to /set-sgv, /set-treatments, etc. (default)
2. the values defined on a screenshot test case, specified by --test-class
"""

import argparse
import json
import os
import sys
import urllib

import requests
from flask import Flask, request
from werkzeug.contrib.cache import SimpleCache
from werkzeug.exceptions import NotFound

import test_screenshots

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
parser.add_argument('--port')
parser.add_argument('--test-class')
args, _ = parser.parse_known_args()

port = int(args.port or os.environ.get('MOCK_SERVER_PORT') or 0)
if port == 0:
    print "Port must be set via MOCK_SERVER_PORT or --port"
    sys.exit()

COLLECTIONS = ['entries', 'treatments', 'profile', 'devicestatus']

cache = SimpleCache(default_timeout=999999)
for coll in COLLECTIONS:
    cache.set(coll, '[]')

app = Flask(__name__)

def _get_post_json(request):
    return json.loads(request.data or request.form.keys()[0])

@app.route('/api/v1/<coll>.json')
def get_collection(coll):
    elements = _collection_from_test(coll, args.test_class) if args.test_class else _collection_from_cache(coll)
    if coll == 'treatments':
        return json.dumps(_filter_treatments(elements, request.args))
    elif elements is not None:
        return json.dumps(elements)
    else:
        raise NotFound

def _collection_from_cache(coll):
    return cache.get(coll) if coll in COLLECTIONS else None

def _collection_from_test(coll, test_class_name):
    # XXX this is very fragile, but for now makes iterating much faster
    reload(test_screenshots)
    if coll == 'entries':
        return getattr(test_screenshots, test_class_name)().sgvs()
    elif coll == 'treatments':
        return getattr(test_screenshots, test_class_name)().treatments()
    elif coll == 'profile':
        return getattr(test_screenshots, test_class_name)().profile()
    elif coll == 'devicestatus':
        return getattr(test_screenshots, test_class_name)().devicestatus()
    else:
        return None

def _filter_treatments(treatments, query):
    # XXX hard-coding the queries performed by the JS
    if query.get('find[eventType]') == 'Temp Basal':
        return [t for t in treatments if 'duration' in t]
    elif query.get('find[insulin][$exists]'):
        return [t for t in treatments if 'insulin' in t]
    else:
        return treatments

@app.route('/set-<coll>', methods=['post'])
def set_collection(coll):
    if coll in COLLECTIONS:
        cache.set(coll, _get_post_json(request))
        return ''
    else:
        raise NotFound

@app.route('/api/v1/entries/sgv.json')
def get_sgv():
    return get_collection('entries')

@app.route('/set-sgv', methods=['post'])
def set_sgv():
    return set_collection('entries')

if __name__ == "__main__":
    app.run(port=port)
