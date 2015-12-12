A Pebble watchface for showing [Nightscout](https://github.com/nightscout/cgm-remote-monitor) CGM data in graph format, like this:

![Screenshot](http://i.imgur.com/9aYMsCn.png)

To install, enable Developer Mode in the Pebble app on your phone, then open [this pbw file][pbw] in the Pebble app.

Urchin CGM is an **U**nopinionated, **R**idiculously **C**onfigurable **H**uman **I**nterface to **N**ightscout. It's still a work-in-progress.

## To configure (for now):
* Set your Nightscout host and display units on the phone. You can customize the graph:

  ![](http://i.imgur.com/CNZ7TS1.png) ![](http://i.imgur.com/97PRtTv.png)

* `config.h` exposes additional settings. `config.c` allows you to change the size, position, and borders of each layout element (e.g., move the graph to the top and time to the bottom, etc.).
* You can show whatever string you want in the status bar (including newlines, if you configure the status bar to be taller) by sending a different value for `statusText` in `main.js`. This can be based on data from any URL, following the pattern of `getIOB()`.

Customizability in both appearance and content is a fundamental design priority. A tool of this kind should respect how personal your relationship with the data is. In cases where configuration is not available, the code should be easy to understand and modify. Here are basic examples of customization via modifications to `config.h` and `config.c`:

![](http://i.imgur.com/OSEmAtZ.png) ![](http://i.imgur.com/YmDYVcF.png)

## Notes:
`1.1 u (1)` means IOB is 1.1 units as of 1 minute ago. This data is [reported by a MiniMed Connect](https://github.com/mddub/minimed-connect-to-nightscout) and probably does not apply for most people, but is easy to customize (see above).

### How do I know how recent the data is?

You can tell by the graph whether the data is recent. If there is no data missing, then the data is up to date. If the data is not recent, there will be a gap:

![](http://i.imgur.com/z72apqX.png)

### How do I determine why the data is not recent?

The data that you see on your watch travels like this: `Rig -> Nightscout -> Phone -> Pebble`.

![](http://i.imgur.com/FqYEiSx.png) There is a problem with the Phone -> Pebble connection; the last time the Pebble heard from the phone was 17 minutes ago. Maybe your phone is out of range. Maybe it's on airplane mode. Maybe you need to charge your phone.

![](http://i.imgur.com/KuzqNK5.png) There is a problem with the Nightscout -> Phone connection; the last time your phone successfully reached Nightscout was 11 minutes ago. Maybe your phone has bad reception. Maybe your Nightscout server is down.

![](http://i.imgur.com/ayrbxEm.png) There is a problem with the Rig -> Nightscout connection; the most recent data point in your Nightscout server is from 26 minutes ago. Maybe there's a problem with your receiver or uploader. Maybe the sensor fell out.

By default, the phone -> Pebble and Nightscout -> phone icons appear after 10 minutes, and the rig -> Nightscout icon appears after 20 minutes. You can customize these thresholds in `config.h`.

## To do (ordered vaguely by priority):
* Generalize configuration of status bar content
* Conserve battery by not redrawing unchanged data
* Stale data alerts
* Show date in time area when space allows
* High/low BG alerts
* Ability to rearrange/hide content within layout elements
* Additional, optional layout elements (bolus visualization, basal visualization, large SGV number a la [cgm-pebble](https://github.com/nightscout/cgm-pebble))
* Integration tests based on visual diffs
* Cache data
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

### Automated screenshot testing

The best method of automated integration testing for Pebble is to take screenshots under different scenarios. To run tests:
```
bash test/do_screenshots.sh
```

This will build the watchface, run it in the emulator, take a screenshot for each test, and generate an HTML file with the results. Each test consists of watchface configuration and mock data. To add a new test case, follow the examples in `test/test_screenshots.py`.

Automated verification of the screenshots is coming soon. For now, you manually inspect them.

### Testing the configuration page

To test changes to the configuration page, set `BUILD_ENV` to `development`. This will build the watchface to point to the local config page (`file:///...`). Using `emu-app-config --file` won't work because it [bypasses the JS][emu-app-config-file] which adds the current config to the query string.
```
BUILD_ENV=development pebble build
pebble install --emulator aplite
pebble emu-app-config
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
[Flask]: http://flask.pocoo.org/
[Mocha]: https://mochajs.org/
[Node]: https://nodejs.org/
[pbw]: https://raw.githubusercontent.com/mddub/urchin-cgm/master/release/urchin-cgm.pbw
[Pebble SDK]: https://developer.getpebble.com/sdk/
