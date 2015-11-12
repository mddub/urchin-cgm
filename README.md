A Pebble watchface for showing [Nightscout](https://github.com/nightscout/cgm-remote-monitor) CGM data in graph format, like this:

![Screenshot](http://i.imgur.com/JHj19C2.png)

Still very much work-in-progress. Architecture is liable to change. Probably soon to be renamed, too.

#### To install:
* Add a `src/js/_config.js` with your Nightscout host and build/install with the Pebble SDK.

#### To configure (for now):
* You can change the graph range and gridline positions in `config.h`.
* You can change the size, position, and borders of each layout element in `config.c`. (e.g., move the graph to the top and time to the bottom, etc.)
* You can show whatever string you want in the status bar (including newlines, if you configure the status bar to be taller) by sending a different value for `statusText` in `main.js`. This can be based on data from any URL, following the pattern of `getIOB()`.

#### Notes:
* `0+0+2` shows the lag in each leg of `Pebble -> phone -> Nightscout -> rig`. In this case, it has been 0 minutes since the Pebble last heard from the phone, 0 minutes since the phone last successfully got data from Nightscout, and the data in Nightscout was 2 minutes old when it was retrieved by the phone. You can use these to diagnose whether a lack of recent data is because of a Bluetooth issue, a network issue, or an issue getting data from your device to Nightscout. The *total* lag is the sum of these, and is indicated visually on the graph, which shows empty space when recent data is missing.
* `2.8 u (1)` means IOB is 2.8 units as of 1 minute ago. This data is [reported by a MiniMed Connect](https://github.com/mddub/minimed-connect-to-nightscout) and probably does not apply for most people, but is easy to customize (see above).

#### To do (ordered vaguely by priority):
* Generalize configuration of status bar content
* Conserve battery by not redrawing unchanged data
* Stale data alerts
* Show watch battery level
* Show date in time area when space allows
* High/low BG alerts
* Ability to rearrange/hide content within layout elements
* Additional, optional layout elements (bolus visualization, basal visualization, large SGV number a la [cgm-pebble](https://github.com/nightscout/cgm-pebble))
* Configuration via phone
* Integration tests based on visual diffs
* Cache data
* Periodically recreate the entire window in an attempt to stop garbled screen issues when the watchface has been running for a long time
* Multiple layouts, toggled by [shaking watch](https://developer.getpebble.com/guides/pebble-apps/sensors/accelerometer/#tap-event-service)
* etc.

The code style favors comprehensibility and extensibility. By design, there is some boilerplate where one might otherwise prefer abstraction. Ideally, that boilerplate makes it easy for you to understand and modify the layout components.

File an issue to report a bug or provide feedback for future development.

## Disclaimer

This project is intended for educational and informational purposes only. It is not FDA approved and should not be used to make medical decisions. It is neither affiliated with nor endorsed by Dexcom.
