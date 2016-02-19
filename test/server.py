import os
import urllib

import requests
from flask import Flask, request
from werkzeug.contrib.cache import SimpleCache

port = int(os.environ['MOCK_SERVER_PORT'])

cache = SimpleCache()
cache.set('config', '{}')
cache.set('sgv', '[]')

app = Flask(__name__)

def _get_post_data(request):
    return request.data or request.form.keys()[0]

@app.route('/auto-config', methods=['get'])
def auto_config():
    """Pebble config page which immediately returns config values.

    Normally, the config page receives a return_to query parameter, to which it
    must redirect using JavaScript, appending the user's preferences. When this
    endpoint is requested by the Pebble SDK as if it were a config page, it
    immediately GETs the return_to url, appending whatever preferences were set
    in the cache by the most recent POST to /set-config.
    """
    return_to = request.args.get('return_to')
    requests.get(return_to + urllib.quote(cache.get('config')))
    return ''

@app.route('/set-config', methods=['post'])
def set_config():
    cache.set('config', _get_post_data(request))
    return ''

@app.route('/api/v1/entries/sgv.json')
def sgv():
    return cache.get('sgv')

@app.route('/set-sgv', methods=['post'])
def set_sgv():
    cache.set('sgv', _get_post_data(request))
    return ''

@app.route('/api/v1/devicestatus.json')
def devicestatus():
    return '[]'

@app.route('/api/v1/treatments.json')
def treatments():
    return '[]'

@app.route('/api/v1/profile.json')
def profile():
    return '[]'

if __name__ == "__main__":
    app.run(
        debug=True,
        port=port,
    )
