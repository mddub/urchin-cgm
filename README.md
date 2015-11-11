A Pebble watchface for showing [Nightscout](https://github.com/nightscout/cgm-remote-monitor) CGM data in graph format, like this:

![Screenshot](http://i.imgur.com/DfCeIs2.png)

Still very much work-in-progress. Architecture is liable to change. Probably soon to be renamed, too.

#### To install:
* Add a `src/js/_config.js` with your Nightscout host and build/install with the Pebble SDK.

#### To configure (for now):
* You can change the graph range and gridline positions in `config.h`.
* You can change the size, position, and borders of each layout element in `config.c`. (e.g., move the graph to the top and time to the bottom, etc.)
* You can show whatever string you want in the status bar (including newlines, if you configure the status bar to be taller) by sending a different value for `statusText` in `main.js`. This can be based on data from any URL, following the pattern of `getIOB()`.

#### Notes:
* `(0/3)` means the Pebble last heard from the phone 0 minutes ago, and the Nightscout data is from 3 minutes ago (actually, the sum of (time since last phone contact) and (age of Nightscout data as of last phone contact) is 3 minutes). This will be improved and moved elsewhere soon.
* `0.8 u (4)` means IOB is 0.8 units as of 4 minutes ago. This data is [reported by a MiniMed Connect](https://github.com/mddub/minimed-connect-to-nightscout) and probably does not apply for most people, but is easy to customize (see above).

#### To do (ordered vaguely by priority):
* Generalize configuration of status bar content
* Conserve battery by not redrawing unchanged data
* Better indicators for phone/web/rig connectivity
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
