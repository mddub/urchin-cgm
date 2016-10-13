# Transform config/index.html so that all of its image, font, CSS, and script
# dependencies are inlined, and convert the result into a data URI.
#
# This makes it possible to view the Urchin configuration page without an
# internet connection.
#
# See https://github.com/pebble/clay for a more robust implementation of offline
# configuration pages.

import base64
import os
import re

out = 'data:text/html;base64'

# Use re instead of something like PyQuery so that the hell of installing lxml
# is not a prerequisite for building the watchface
html = open('config/index.html').read()
css_tags = re.findall('(<link[^>]* href="([^"]+)">)', html, re.I)
assert len(css_tags) == 1

css = open('config/' + css_tags[0][1]).read()
css_dir = os.path.dirname(css_tags[0][1])
urls = re.findall('(url\(([^)]+)\))', css, re.I)
assert len(urls) > 0
for url in urls:
    filename = url[1]
    filename = re.sub('(^"|"$)', '', filename)
    filename = re.sub("(^'|'$)", '', filename)
    assert filename.endswith('.woff') or filename.endswith('.png')
    full_filename = os.path.join('config', css_dir, filename)
    encoded = base64.b64encode(open(full_filename, "rb").read())
    if filename.endswith('.woff'):
        mime_type = 'application/font-woff'
    else:
        mime_type = 'image/png'
    css = css.replace(
        url[0],
        'url(data:{};base64,{})'.format(mime_type, encoded)
    )

# TODO trim newlines/whitespace in css
html = html.replace(
    css_tags[0][0],
    '<style type="text/css">{}</style>'.format(css)
)

js_tags = re.findall('(<script[^>]* src="([^"]+)"></script>)', html, re.I)
assert len(js_tags) > 0
for js_tag in js_tags:
    filename = js_tag[1]
    # TODO trim newlines/whitespace
    js = open('config/' + js_tag[1]).read()
    html = html.replace(
        js_tag[0],
        '<script type="text/javascript">{}</script>'.format(js)
    )

# TODO trim newlines/whitespace
print html
