A Pebble watchface for viewing [Nightscout](https://github.com/nightscout/cgm-remote-monitor) CGM data in graph format, like this:

![Screenshot](http://i.imgur.com/HzBtKpf.png)

To install, enable Developer Mode in the Pebble app on your phone, then open [this pbw file][pbw] in the Pebble app.

Urchin CGM is an **U**nopinionated, **R**idiculously **C**onfigurable **H**uman **I**nterface to **N**ightscout. It's not released yet / in beta / a work-in-progress.

[![Circle CI](https://circleci.com/gh/mddub/urchin-cgm.svg?style=shield)](https://circleci.com/gh/mddub/urchin-cgm)

## Setup

In the Pebble app on your phone, open the "Settings" screen to set your Nightscout URL.

## Layout

The layout is one of the most Ridiculously Configurable aspects of Urchin. The settings page includes a handful of pre-set layouts to get you started:

![](http://i.imgur.com/4DhR6s8.png) ![](http://i.imgur.com/3dV3dKa.png) ![](http://i.imgur.com/tX352M2.png)

Use one as a starting point to build your own watchface: reorder the elements, change heights and colors, toggle borders, move the icons...

## Graph

Set the bounds and target range of the graph on your phone.

You can choose the shape and size of the points on the graph so that the glucose history is as long or as short as you want. To show up to 12 hours of BGs, plot the points super-thin or overlapping. For a "sparkline" view of the last hour, plot bigger points with more space in between.

![](http://i.imgur.com/D91OqLn.png) ![](http://i.imgur.com/7RBWAhe.png)

## Status bar content

The status bar can display content from a variety of sources:

* **Uploader battery level** - if your Nightscout data comes from a wired rig/xDrip. (e.g. `36%`)
* **Raw Dexcom readings** - [raw sensor readings][raw-dexcom-readings] plus noise level. (e.g. `Cln 97 104 106`)
* **Uploader battery, Dexcom raw** - combination of the above two. (e.g. `36% Cln 97 104 106`)
* **Active basal - NS Care Portal** - the currently-active basal rate based on treatments in [Nightscout Care Portal][care-portal]. If a temp basal is currently active, shows the difference from normal basal and how many minutes ago the temp basal began. (e.g. `1.5u/h +0.6 (19)`)
* **Insulin on board** - this can be calculated from treatments entered manually in [Nightscout Care Portal][care-portal], or reported automatically by a [MiniMed Connect][minimed-connect] or [OpenAPS][openaps-status-uploads] device. (e.g. `2.3 u`)
* **Insulin + carbs on board** - same IOB as above plus carbs-on-board entered in Care Portal. (e.g. `2.3 u  31 g`)
* **IOB and temp - OpenAPS** - IOB and currently-active temp basal rate from the most recent [OpenAPS status upload][openaps-status-uploads], or if the most recent status indicates failure, the time since that failure plus the time and IOB from the last successful status. (e.g. `(2) 1.1u 1.9x13` or `(4) -- | (23) 2.2u`)
* **Custom URL - text** - if you want to summarize your data in a custom way.
* **Custom URL - JSON** - show custom text, with support for a `timestamp` field to display recency (e.g. `(3) your text`).
* **Custom text** - remind yourself whose glucose readings you're looking at, or leave a terse inspirational message.
* **Multiple** - Up to 3 of the above, one on each line.

## Pump data

If you are using Nightscout to track data from an insulin pump, you may choose to display **bolus history** (as ticks) and/or **basal history** (as a bar graph):

![](http://i.imgur.com/UmQ5Yqx.png)

To enter pump data manually, you can use [Nightcout Care Portal][care-portal] or the ["CarePortal" Pebble app][pebble-care-portal].

To upload pump data automatically, you can use [RileyLink][rileylink_ios] or [Loop][loop] on iOS, or build an [OpenAPS uploader][openaps].

## What do the icons mean?

The data that you see on your watch travels like this: `Rig -> Nightscout -> Phone -> Pebble`.

![](http://i.imgur.com/8D9uIWo.png) There is a problem with the Phone -> Pebble connection; the last time the Pebble heard from the phone was 17 minutes ago. Maybe your phone is out of range. Maybe it's on airplane mode. Maybe you need to charge your phone.

![](http://i.imgur.com/cNiLolr.png) There is a problem with the Nightscout -> Phone connection; the last time your phone successfully reached Nightscout was 11 minutes ago. Maybe your phone has bad reception. Maybe your Nightscout server is down.

![](http://i.imgur.com/gfaaZnQ.png) There is a problem with the Rig -> Nightscout connection; the most recent data point in your Nightscout server is from 26 minutes ago. Maybe there's a problem with your receiver or uploader. Maybe the sensor fell out.

When the watch fails to fetch data, a message describing the problem briefly appears in the graph.

## Contributing

Contributions are welcome in the form of bugs and pull requests. To report a bug or provide feedback, please [file an issue][file-issue]. To contribute code, please use the instructions below to build and test the watchface.

* Install the [Pebble SDK Tool].

* Install and activate the Pebble SDK. As of this writing, the app is built with SDK 3.14, but later versions should work, too.
  ```
  pebble sdk install 3.14
  pebble sdk activate 3.14
  ```

* Build and run the watchface with a command like:
  ```
  pebble clean && pebble build && pebble install --emulator basalt && pebble logs
  ```

* The watchface will ask for settings from the "phone." Open the configuration page with this command and hit "save" in your browser (you'll need to do this only once):
  ```
  pebble emu-app-config --emulator basalt
  ```

* At some point you'll want to install your revisions on your watch. Flip the "Enable Developer Connections" switch in the Pebble app on your phone, then:
  ```
  pebble install --phone <phone ip address>
  ```

**Tips:**

* **Testing the configuration page**: If you make changes to the configuration page, you must build the watchface to point to your local copy of the page (`file:///...`). To do this, set `BUILD_ENV` to `development`. (More info [here][build-env-development].)
  ```
  BUILD_ENV=development pebble build
  pebble install --emulator basalt
  pebble emu-app-config --emulator basalt
  ```

* **Syntax checking:** If you use Vim, I highly recommend using [Syntastic] to display syntax errors. On my OS X system running Pebble Tool v4.1.1, these lines make Syntastic aware of Pebble's header files and suppress warnings generated within those files:

  ```
  let g:syntastic_c_include_dirs = ['/Users/<user>/Library/Application Support/Pebble SDK/SDKs/current/sdk-core/pebble/aplite/include', 'build/aplite']
  let g:syntastic_c_remove_include_errors = 1
  ```

* **JavaScript errors:** If you see a JavaScript error in the console, the line numbers will be reported relative to `build/pebble-js-app.js`, which is the concatenation of all files in `src/js/**/*.js`.

## Testing

Since this software displays real-time health data, it is important to be able to verify that it works as expected.

The most effective method of integration testing I've found is to [compare screenshots][screenshots-artifact]. This relies on [ImageMagick] to compute diffs. Screenshot tests and JavaScript unit tests are run automatically by CircleCI.

* **Running screenshot tests locally**

  Install [ImageMagick], then use `pip` to install Python testing dependencies:
  ```
  pip install -r requirements.txt --user
  ```

  Run the tests:
  ```
  . test/do_screenshots.sh
  ```

* **Running an individual screenshot test**
  ```
  . test/do_screenshots.sh -k TestName
  ```

* **Using the mock Nightscout server**

  Start the server:
  ```
  MOCK_SERVER_PORT=5555 python test/server.py
  ```

  Build the watchface as usual:
  ```
  pebble clean && pebble build && pebble install --emulator basalt && pebble logs
  ```

  Use an editor to save mock data, send it to the server, verify it:
  ```
  vi sgv-data.json
  # ...edit mock data...

  # POST it for the server to store
  curl -d @sgv-data.json http://localhost:5555/set-sgv

  # Verify:
  curl http://localhost:5555/api/v1/entries/sgv.json

  # ("sgv" can be sgv, entries, treatments, devicestatus, or profile)
  ```

  Use the browser to configure the watchface:
  ```
  # Make sure you set the Nightscout host to "http://localhost:5555"
  pebble emu-app-config --emulator basalt
  ```

* **Running JavaScript unit tests locally**

  These require [Node]. See the [Mocha] and [Expect] docs.

  ```
  cd test/js
  npm install
  npm test
  ```

## To do:
* High/low BG alerts
* Stale data alerts
* Show date when space allows
* More color configurability
* A fixed layout which supports Pebble Time Round
* Use data directly from Dexcom Share (no Nightscout site required)
* More dynamic sizing of content (e.g. bigger/smaller time and BG)
* etc.

## Disclaimer

This project is intended for educational and informational purposes only. It is not FDA approved and should not be used to make medical decisions. It is neither affiliated with nor endorsed by Dexcom.

[build-env-development]: https://github.com/mddub/urchin-cgm/blob/ede29c/wscript#L17
[care-portal]: http://www.nightscout.info/wiki/welcome/website-features/cgm-remote-monitor-care-portal
[Expect]: https://github.com/Automattic/expect.js
[file-issue]: https://github.com/mddub/urchin-cgm/issues
[Flask]: http://flask.pocoo.org/
[ImageMagick]: http://www.imagemagick.org/
[js-unit-tests]: https://github.com/mddub/urchin-cgm/tree/master/test/js
[loop]: https://github.com/LoopKit/Loop
[minimed-connect]: http://www.nightscout.info/wiki/welcome/website-features/funnel-cake-0-8-features/minimed-connect-and-nightscout
[Mocha]: https://mochajs.org/
[Node]: https://nodejs.org/
[openaps]: https://github.com/openaps/docs
[openaps-status-uploads]: http://openaps.readthedocs.io/en/latest/docs/walkthrough/phase-1/visualization.html
[pbw]: https://raw.githubusercontent.com/mddub/urchin-cgm/master/release/urchin-cgm.pbw
[Pebble SDK Tool]: https://developer.getpebble.com/sdk/
[pebble-care-portal]: https://apps.getpebble.com/en_US/application/568fb97705f633b362000045
[raw-dexcom-readings]: http://www.nightscout.info/wiki/labs/interpreting-raw-dexcom-data
[rileylink_ios]: https://github.com/ps2/rileylink_ios
[screenshots-artifact]: https://circleci.com/api/v1/project/mddub/urchin-cgm/latest/artifacts/0/$CIRCLE_ARTIFACTS/output/screenshots.html
[Syntastic]: https://github.com/scrooloose/syntastic
