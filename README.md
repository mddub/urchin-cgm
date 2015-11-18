A Pebble watchface for showing [Nightscout](https://github.com/nightscout/cgm-remote-monitor) CGM data in graph format, like this:

![Screenshot](http://i.imgur.com/9aYMsCn.png)

To install, enable Developer Mode in the Pebble app on your phone, then open [this pbw file][pbw] in the Pebble app.

Still very much work-in-progress. Probably soon to be renamed, too.

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

## Disclaimer

This project is intended for educational and informational purposes only. It is not FDA approved and should not be used to make medical decisions. It is neither affiliated with nor endorsed by Dexcom.

[pbw]: https://raw.githubusercontent.com/mddub/nightscout-graph-pebble/master/release/nightscout-graph-pebble.pbw
