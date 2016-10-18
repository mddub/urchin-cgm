# Transform config/index.html so that all of its image, font, CSS, and script
# dependencies are inlined, and convert the result into a data URI.
#
# This makes it possible to view the Urchin configuration page without an
# internet connection. Also, since the config page is bundled with the app
# (rather than hosted on the web), its available settings always match the
# features of the current version.
#
# See https://github.com/pebble/clay for a more robust implementation of offline
# configuration pages.

import base64
import json
import os
# Use re instead of something like PyQuery so that the hell of installing lxml
# is not a prerequisite for building the watchface
import re
import subprocess

def call_minify(command_str, stdin, filename):
    parts = command_str.split(' ')
    try:
        proc = subprocess.Popen(parts, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    except Exception, e:
        raise Exception("Command failed: {}: {}".format(command_str, e))
    out, err = proc.communicate(input=stdin)
    if err:
        print command_str
        raise Exception('{}: {}: failed with return code {}'.format(command_str, filename, err))
    else:
        print '{}: {}: {} -> {} bytes'.format(parts[0], filename, len(stdin), len(out))
        return out

def make_inline_config(task, html_file_node):
    config_dir = html_file_node.parent.abspath()

    html = html_file_node.read()
    css_tags = re.findall('(<link[^>]* href="([^"]+)">)', html, re.I)
    assert len(css_tags) == 1

    css_filename = os.path.join(config_dir, css_tags[0][1])
    css_dir = os.path.dirname(css_filename)

    css = open(css_filename).read()
    css = re.sub('\s*([{}:;])\s*', lambda match: match.group(1), css)

    urls = re.findall('(url\(([^)]+)\))', css, re.I)
    assert len(urls) > 0
    for url in urls:
        filename = url[1]
        filename = re.sub('(^"|"$)', '', filename)
        filename = re.sub("(^'|'$)", '', filename)
        assert filename.endswith('.png')
        mime_type = 'image/png'
        encoded = base64.b64encode(open(os.path.join(css_dir, filename), "rb").read())
        css = css.replace(
            url[0],
            'url(data:{};base64,{})'.format(mime_type, encoded)
        )

    minified_css = call_minify('./node_modules/clean-css/bin/cleancss', css, os.path.relpath(css_filename))

    html = html.replace(
        css_tags[0][0],
        '<style>{}</style>'.format(minified_css)
    )

    js_tags = re.findall('(<script[^>]* src="([^"]+)"></script>)', html, re.I)
    assert len(js_tags) > 0
    for js_tag in js_tags:
        js_filename = os.path.join(config_dir, js_tag[1])
        js = open(js_filename).read()
        minified_js = call_minify('./node_modules/uglify-js/bin/uglifyjs', js, os.path.relpath(js_filename))
        html = html.replace(
            js_tag[0],
            '<script>{}</script>'.format(minified_js)
        )

    minified_html = call_minify('./node_modules/html-minifier/cli.js --remove-comments --remove-attribute-quotes', html, html_file_node.relpath())

    return json.dumps({'configPage': minified_html})
