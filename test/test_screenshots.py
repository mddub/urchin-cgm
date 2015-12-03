import math
from datetime import datetime
from datetime import timedelta

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


class TestBasicIntegration(ScreenshotTest):
    """Test that the graph, delta, trend, etc. all work."""
    sgvs = default_entries('FortyFiveDown')


class TestMmolAndTimeAndBatteryPositioning(ScreenshotTest):
    """Test mmol, plus repositioning time and battery."""
    config = {
        'mmol': True,
        'timeAlign': 'right',
        'batteryLoc': 'timeBottomLeft',
    }
    sgvs = default_entries('Flat')


class TestTimeLeftBatteryTopRight(ScreenshotTest):
    """Test left-aligning time and putting battery in top right of time area."""
    config = {
        'timeAlign': 'left',
        'batteryLoc': 'timeTopRight',
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


class TestStaleServerData(ScreenshotTest):
    """Test that when server data is stale, an icon appears."""
    sgvs = default_entries('SingleDown')[7:]


class TestNotRecentButNotYetStale(ScreenshotTest):
    """Test that trend and delta are not shown when data is not recent."""
    sgvs = default_entries('SingleDown')[2:]


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


class TestNoSGVs(ScreenshotTest):
    """Test that the watchface indicates when there are no recent SGV entries."""
    sgvs = []
