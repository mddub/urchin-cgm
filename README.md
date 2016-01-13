A Pebble watchface for viewing [Nightscout](https://github.com/nightscout/cgm-remote-monitor) CGM data in graph format, like this:

![Screenshot](http://i.imgur.com/yc5EQTW.png)

To install, enable Developer Mode in the Pebble app on your phone, then open [this pbw file][pbw] in the Pebble app.

Urchin CGM is an **U**nopinionated, **R**idiculously **C**onfigurable **H**uman **I**nterface to **N**ightscout. It's not released yet / in beta / a work-in-progress.

## Setup

Set your Nightscout host and display units on the phone. You can customize the graph:

![](http://i.imgur.com/43SfgkQ.png) ![](http://i.imgur.com/X5RyYZq.png)

## Status bar content

The status bar can display content from a variety of sources:

* **Uploader battery level** - if your Nightscout data comes from a wired rig/xDrip. (e.g. `36%`)
* **Raw Dexcom readings** - [raw sensor readings][raw-dexcom-readings] plus noise level. (e.g. `Cln 97 104 106`)
* **Uploader battery, Dexcom raw** - combination of the above two. (e.g. `36% Cln 97 104 106`)
* **Active basal - OpenAPS** - the currently-active basal rate based on treatments in Nightscout Care Portal. If a temp basal is currently active, shows the difference from normal basal and how many minutes ago the temp basal began. (e.g. `1.5u/h +0.6 (19)`)
* **Pump IOB - MiniMed Connect** - the bolus IOB reported by a [MiniMed Connect][minimed-connect]. (e.g. `2.3u`)
* **Custom URL** - if you want to summarize your data in a custom way.
* **Custom text** - remind yourself whose glucose readings you're looking at, or leave a terse inspirational message.

## How can I tell how recent the data is?

You can tell by the graph whether the data is recent. If there is no data missing, then the data is up to date. If the data is not recent, there will be a gap:

![](http://i.imgur.com/toDzQea.png)

## How can I tell why the data is not recent?

The data that you see on your watch travels like this: `Rig -> Nightscout -> Phone -> Pebble`.

![](http://i.imgur.com/FqYEiSx.png) There is a problem with the Phone -> Pebble connection; the last time the Pebble heard from the phone was 17 minutes ago. Maybe your phone is out of range. Maybe it's on airplane mode. Maybe you need to charge your phone.

![](http://i.imgur.com/KuzqNK5.png) There is a problem with the Nightscout -> Phone connection; the last time your phone successfully reached Nightscout was 11 minutes ago. Maybe your phone has bad reception. Maybe your Nightscout server is down.

![](http://i.imgur.com/ayrbxEm.png) There is a problem with the Rig -> Nightscout connection; the most recent data point in your Nightscout server is from 26 minutes ago. Maybe there's a problem with your receiver or uploader. Maybe the sensor fell out.

By default, the `phone->Pebble` and `Nightscout->phone` icons appear after 10 minutes, and the `rig->Nightscout` icon appears after 20 minutes. You can customize these thresholds in `config.h`.

## Layout

The configuration page includes a handful of layout options, such as:

![](http://i.imgur.com/dOxW8UY.png) ![](http://i.imgur.com/0p89kGG.png) ![](http://i.imgur.com/i9T91Ci.png)

For the adventurous, any layout can be customized: reorder the elements, change their heights, set a different background color...

![](http://i.imgur.com/sANZi9C.png) ![](http://i.imgur.com/648FVQB.png)

## To do (ordered vaguely by priority):
* Cache data
* High/low BG alerts
* Stale data alerts
* Show date when space allows
* Color support for Pebble Time
* A fixed layout which supports Pebble Time Round
* Recency indicator (like Dexcom's warm-up pie chart)
* Ability to view longer time scale
* More dynamic sizing of content (e.g. bigger/smaller time and BG)
* Additional layout elements (bolus visualization, basal visualization, second status)
* Integration tests based on visual diffs
* etc.

File an issue to report a bug or provide feedback for future development.

## Testing

Since this software displays real-time health data, it is important to be able to verify that it works as expected. This project includes two tools to aid testing: a mock Nightscout server and automated screenshot testing.

To install testing dependencies, use `pip`:
```
pip install -r requirements.txt
```

These instructions assume you are using the [Pebble SDK]. You can build and run the project with a command like:
```
pebble clean && pebble build && pebble install --emulator aplite && pebble logs
```

### Mock Nightscout server

The `test/` directory includes a server which uses the [Flask] framework. To run it:
```
MOCK_SERVER_PORT=5555 python test/server.py
```

Then open the configuration page to set your Nightscout host to `http://localhost:5555`:
```
pebble emu-app-config
# ...make configuration changes in web browser...
```

To set the data that will be returned by the `sgv.json` endpoint:
```
vi sgv-data.json
# ...edit mock data...
curl -d @sgv-data.json http://localhost:5555/set-sgv
```

Verify:
```
curl http://localhost:5555/api/v1/entries/sgv.json
```

### Automated screenshot testing

Writing integration tests for Pebble is not simple. The best method I have found is to take screenshots. Each test case provides watchface configuration and SGV data to the mock server, triggers the emulator to open a configuration page hosted on the mock server, and [does magic][emu-app-config-magic] to pass the stored configuration back to the emulator. By design, receiving new configuration causes the watchface to request new data from the mock server. A screenshot can then be saved for that combination of configuration and data.

To run tests:
```
bash test/do_screenshots.sh
```

This will build the watchface, run it in the emulator, take a screenshot for each test, and generate an HTML file with the results. To add a new test case, follow the examples in `test/test_screenshots.py`.

Automated verification of the screenshots and CI are coming soon. For now, you manually inspect them.

### Testing the configuration page

To test changes to the configuration page locally, set `BUILD_ENV` to `development`. This will build the watchface to point to the local config page (`file:///...`). Using `emu-app-config --file` won't work because it [bypasses the PebbleKit JS][emu-app-config-file] which adds the current config to the query string.
```
BUILD_ENV=development pebble build
pebble install --emulator aplite
pebble emu-app-config --emulator aplite
```

### JavaScript unit tests

There are a few [Mocha] unit tests to verify the transformation of Nightscout data in PebbleKit JS. These are run with [Node].

```
cd test/js
npm install
npm test
```

## Disclaimer

This project is intended for educational and informational purposes only. It is not FDA approved and should not be used to make medical decisions. It is neither affiliated with nor endorsed by Dexcom.

[emu-app-config-file]: https://github.com/pebble/pebble-tool/blob/0e51fa/pebble_tool/commands/emucontrol.py#L116
[emu-app-config-magic]: https://github.com/mddub/urchin-cgm/blob/ea2831/test/util.py#L36
[Flask]: http://flask.pocoo.org/
[minimed-connect]: http://www.nightscout.info/wiki/welcome/website-features/funnel-cake-0-8-features/minimed-connect-and-nightscout
[Mocha]: https://mochajs.org/
[Node]: https://nodejs.org/
[pbw]: https://raw.githubusercontent.com/mddub/urchin-cgm/master/release/urchin-cgm.pbw
[Pebble SDK]: https://developer.getpebble.com/sdk/
[raw-dexcom-readings]: http://www.nightscout.info/wiki/labs/interpreting-raw-dexcom-data
