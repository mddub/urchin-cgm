import os
import urllib

import requests
from flask import Flask, request
from werkzeug.contrib.cache import SimpleCache
from werkzeug.exceptions import NotFound

port = int(os.environ['MOCK_SERVER_PORT'])

COLLECTIONS = ['entries', 'treatments', 'profile', 'devicestatus']

cache = SimpleCache(default_timeout=999999)
for collection in COLLECTIONS:
    cache.set(collection, '[]')

app = Flask(__name__)

def _get_post_data(request):
    return request.data or request.form.keys()[0]

@app.route('/api/v1/<collection>.json')
def get_collection(collection):
    if collection in COLLECTIONS:
        return cache.get(collection)
    else:
        raise NotFound

@app.route('/set-<collection>', methods=['post'])
def set_collection(collection):
    if collection in COLLECTIONS:
        cache.set(collection, _get_post_data(request))
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
