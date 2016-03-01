import copy
import math
from datetime import datetime
from datetime import timedelta

from util import BASE_CONFIG
from util import CONSTANTS
from util import MOCK_HOST
from util import ScreenshotTest

DIRECTION_TO_TREND = dict([
    ('DoubleUp', 1),
    ('SingleUp', 2),
    ('FortyFiveUp', 3),
    ('Flat', 4),
    ('FortyFiveDown', 5),
    ('SingleDown', 6),
    ('DoubleDown', 7),
])

def default_sgv_series(count=50):
    return [
        max(30, int(200 - 3 * i + 10 * math.sin(2 * i / math.pi)))
        for i in range(count)
    ]

def default_dates(count=50):
    now = datetime.now()
    return [
        int((now - timedelta(minutes=5 * i)).strftime('%s')) * 1000
        for i in range(count)
    ]

def default_entries(direction, count=50):
    return [
        {
            'type': 'sgv',
            'sgv': sgv,
            'date': date,
            'direction': direction,
            'trend': DIRECTION_TO_TREND[direction],
        }
        for sgv, date
        in zip(default_sgv_series(count), default_dates(count))
    ]

def some_real_life_entries():
    sgvs = [190, 188, 180, 184, 184, 177, 174, 163, 152, 141, 134, 127, 124, 121, 117, 109, 103, 97, 94, 88, 79, 79, 75, 79, 84, 87, 88, 91, 91, 91, 94, 99, 102, 107, 106, 108, 107, 108, 115, 111, 114, 113, 115, 118, 120, 119, 120, 122, 123, 126, 122, 125, 125, 126, 125, 122, 122, 122, 119, 118, 118, 118, 117, 116, 115, 114, 114, 115, 114, 113, 114, 115, 111, 114, 115, 114, 114, 116, 117, 117, 118, 119, 121, 124, 125, 128, 126, 128, 131, 133, 135, 136, 135, 134, 132, 130]
    return [
        {
            'type': 'sgv',
            'sgv': sgv,
            'date': date,
            'direction': 'Flat',
            'trend': 4,
        }
        for sgv, date
        in zip(sgvs, default_dates(len(sgvs)))
    ]

def mutate_element(layout, el_name, props):
    for el in layout['elements']:
        if CONSTANTS['ELEMENTS'][el['el']] == el_name:
            el.update(props)


class TestBasicIntegration(ScreenshotTest):
    """Test that the graph, delta, trend, etc. all work."""
    sgvs = default_entries('FortyFiveDown')


class TestMmol(ScreenshotTest):
    """Test mmol."""
    config = {
        'mmol': True,
    }
    sgvs = default_entries('Flat')


class TestGraphBoundsAndGridlines(ScreenshotTest):
    """Test adjusting the graph bounds and gridlines."""
    config = {
        'topOfGraph': 400,
        'topOfRange': 280,
        'bottomOfRange': 120,
        'bottomOfGraph': 20,
        'hGridlines': 20,
    }
    sgvs = default_entries('DoubleUp')


class TestSGVsAtBoundsAndGridlines(ScreenshotTest):
    """Test that the placement of target range bounds and gridlines is consistent with the placement of SGV points."""
    @property
    def sgvs(self):
        sgvs = default_entries('Flat')
        for i, s in enumerate(sgvs):
            if i < 9:
                s['sgv'] = BASE_CONFIG['topOfRange']
            elif i < 18:
                s['sgv'] = BASE_CONFIG['topOfRange'] - BASE_CONFIG['hGridlines']
            elif i < 27:
                s['sgv'] = BASE_CONFIG['topOfRange'] - BASE_CONFIG['hGridlines'] * 2
            else:
                s['sgv'] = BASE_CONFIG['bottomOfRange']
        return sgvs

class TestStaleServerData(ScreenshotTest):
    """Test that when server data is stale, an icon appears."""
    sgvs = default_entries('SingleDown')[7:]


class TestNotRecentButNotYetStaleSidebar(ScreenshotTest):
    """Test that trend and delta are not shown in the sidebar when data is not recent."""
    sgvs = default_entries('SingleDown')[2:]
    config = {'layout': 'a'}


class TestNotRecentButNotYetStaleBGRow(ScreenshotTest):
    """Test that trend and delta are not shown in the BG row when data is not recent."""
    sgvs = default_entries('SingleDown')[2:]
    config = {'layout': 'c'}


class TestErrorCodes(ScreenshotTest):
    """Test that error codes appear as ??? and are not graphed."""
    @property
    def sgvs(self):
        s = default_entries('SingleDown')
        for i in range(0, 19, 3):
            s[i]['sgv'] = s[i + 1]['sgv'] = 10
        del s[0]['direction']
        del s[0]['trend']
        return s


class TestPositiveDelta(ScreenshotTest):
    """Test that positive deltas have "+" prepended and are not treated as error codes."""
    @property
    def sgvs(self):
        s = default_entries('SingleUp')
        s[1]['sgv'] = s[0]['sgv'] - 10
        return s


class TestTrimmingValues(ScreenshotTest):
    """Test that values outside the graph bounds are trimmed."""
    config = {
        'topOfGraph': 250,
        'topOfRange': 200,
        'bottomOfRange': 80,
        'bottomOfGraph': 40,
        'hGridlines': 50,
    }
    @property
    def sgvs(self):
        s = default_entries('DoubleDown')
        for i in range(12):
            s[i]['sgv'] = 20 + 4 * i
        for i in range(12, 24):
            s[i]['sgv'] = 64 + 15 * (i - 12)
        for i in range(24, len(s)):
            s[i]['sgv'] = 229 + 9 * (i - 24)
        return s


class TestDegenerateEntries(ScreenshotTest):
    """Test that "bad" SGV entries don't cause the watchface to crash."""
    @property
    def sgvs(self):
        s = default_entries('DoubleDown')
        # A raw-only entry won't have sgv, shouldn't be graphed
        for i in range(6, 12):
            del s[i]['sgv']
        # Some uploaders sometimes give trend and direction as null
        s[0]['trend'] = s[0]['direction'] = None
        return s


class TestBlackBackground(ScreenshotTest):
    """Test that the time, status bar, sidebar, and graph elements can be set to a black background."""
    @property
    def config(self):
        layout = copy.deepcopy(CONSTANTS['LAYOUTS']['a'])
        elements_under_test = [CONSTANTS['ELEMENTS'][el['el']] for el in layout['elements']]
        assert all([
            el in elements_under_test
            for el
            in ('TIME_AREA_ELEMENT', 'STATUS_BAR_ELEMENT', 'SIDEBAR_ELEMENT', 'GRAPH_ELEMENT')
        ])

        for el in layout['elements']:
            el['black'] = True
        return {
            'layout': 'custom',
            'customLayout': layout,
            'statusContent': 'customtext',
            'statusText': 'black as coal',
        }

    sgvs = default_entries('Flat')


class TestStatusTextTooLong(ScreenshotTest):
    """Test that the watchface doesn't crash when the status text is too long."""
    config = {
        'statusContent': 'customtext',
        'statusText': '^_^ ' * 100,
    }
    sgvs = default_entries('Flat')


class TestLayoutA(ScreenshotTest):
    """Test layout A."""
    sgvs = some_real_life_entries()
    config = {
        'layout': 'a',
        'statusContent': 'customtext',
        'statusText': 'Cln 179 186 187',
    }


class TestLayoutB(ScreenshotTest):
    """Test layout B."""
    sgvs = some_real_life_entries()
    config = {
        'layout': 'b',
        'statusContent': 'customtext',
        'statusText': 'Cln 179 186 187',
    }


class TestLayoutC(ScreenshotTest):
    """Test layout C."""
    sgvs = some_real_life_entries()
    config = {
        'layout': 'c',
        'statusContent': 'customtext',
        'statusText': 'Cln 179 186 187',
    }


class TestLayoutD(ScreenshotTest):
    """Test layout D."""
    sgvs = some_real_life_entries()
    config = {
        'layout': 'd',
    }


class TestLayoutE(ScreenshotTest):
    """Test layout E."""
    sgvs = some_real_life_entries()
    config = {
        'layout': 'e',
        'statusContent': 'customtext',
        'statusText': 'More space for extra long text. Monitoring a DIY artificial pancreas, perhaps?',
    }


class TestLayoutCustom(ScreenshotTest):
    """Test the default custom layout."""
    sgvs = some_real_life_entries()
    config = {
        'layout': 'custom',
        'customLayout': BASE_CONFIG['customLayout'],
        'statusContent': 'customtext',
        'statusText': 'You are marvelous. The gods wait to delight in you.'
    }


class BaseBatteryLocInStatusTest(ScreenshotTest):
    status_props = None
    status_text = None

    @property
    def __test__(self):
        return not self.__class__ == BaseBatteryLocInStatusTest

    @property
    def config(self):
        layout = copy.deepcopy(CONSTANTS['LAYOUTS']['e'])
        layout['batteryLoc'] = 'statusRight'
        mutate_element(layout, 'STATUS_BAR_ELEMENT', self.status_props)
        return {
            'layout': 'custom',
            'customLayout': layout,
            'statusContent': 'customtext',
            'statusText': self.status_text,
        }

    sgvs = default_entries('FortyFiveDown')


class TestBatteryLocInStatusAlignedWithLastLineOfText(BaseBatteryLocInStatusTest):
    """Test that the battery is aligned to the bottom line of text in the status bar."""
    status_props = {'height': 28}
    status_text = 'Battery is level with last completely visible line of text'


class TestBatteryLocInStatusMinimumPadding(BaseBatteryLocInStatusTest):
    """Test that the battery has a minimum bottom padding."""
    status_props = {'height': 21, 'bottom': True}
    status_text = 'Should not be flush against the bottom'


class TestBatteryAsNumber(ScreenshotTest):
    sgvs = default_entries('FortyFiveUp')
    config = {
        'layout': 'a',
        'statusContent': 'customtext',
        'statusText': 'battery ------>',
        'batteryAsNumber': True,
    }

class BaseDynamicTimeFontTest(ScreenshotTest):
    sgvs = default_entries('Flat')
    time_height = None

    @property
    def __test__(self):
        return not self.__class__ == BaseDynamicTimeFontTest

    @property
    def config(self):
        layout = copy.deepcopy(CONSTANTS['LAYOUTS']['e'])
        mutate_element(layout, 'TIME_AREA_ELEMENT', {
            'black': True,
            'height': self.time_height,
        })
        return {
            'layout': 'custom',
            'customLayout': layout,
            'statusContent': 'customtext',
            'statusText': 'time height: %s%%' % self.time_height
        }

class TestDynamicTimeFont18(BaseDynamicTimeFontTest):
    time_height = 18

class TestDynamicTimeFont14(BaseDynamicTimeFontTest):
    time_height = 14

class TestDynamicTimeFont10(BaseDynamicTimeFontTest):
    time_height = 10

class TestDynamicTimeFont6(BaseDynamicTimeFontTest):
    time_height = 6
