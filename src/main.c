#include <pebble.h>

#include "app_keys.h"
#include "bg_row_element.h"
#include "comm.h"
#include "config.h"
#include "layout.h"
#include "graph_element.h"
#include "preferences.h"
#include "status_bar_element.h"
#include "sidebar_element.h"
#include "time_element.h"

static Window *s_window;

static TimeElement *s_time_element = NULL;
static GraphElement *s_graph_element = NULL;
static SidebarElement *s_sidebar_element = NULL;
static StatusBarElement *s_status_bar_element = NULL;
static BGRowElement *s_bg_row_element = NULL;

static void minute_handler(struct tm *tick_time, TimeUnits units_changed) {
  if (s_time_element != NULL) {
    time_element_tick(s_time_element);
  }
  if (s_graph_element != NULL) {
    graph_element_tick(s_graph_element);
  }
  if (s_sidebar_element != NULL) {
    sidebar_element_tick(s_sidebar_element);
  }
  if (s_status_bar_element != NULL) {
    status_bar_element_tick(s_status_bar_element);
  }
  if (s_bg_row_element != NULL) {
    bg_row_element_tick(s_bg_row_element);
  }
}

static void window_load(Window *window) {
  LayoutLayers layout = init_layout(window);

  if (layout.time_area != NULL) {
    // ensure the time is drawn before anything else
    s_time_element = time_element_create(layout.time_area);
    time_element_tick(s_time_element);
  }

  if (layout.graph != NULL) {
    s_graph_element = graph_element_create(layout.graph);
  }
  if (layout.sidebar != NULL) {
    s_sidebar_element = sidebar_element_create(layout.sidebar);
  }
  if (layout.status_bar != NULL) {
    s_status_bar_element = status_bar_element_create(layout.status_bar);
  }
  if (layout.bg_row != NULL) {
    s_bg_row_element = bg_row_element_create(layout.bg_row);
  }

  tick_timer_service_subscribe(MINUTE_UNIT, minute_handler);
}

static void window_unload(Window *window) {
  if (s_time_element != NULL) {
    time_element_destroy(s_time_element);
    s_time_element = NULL;
  }
  if (s_graph_element != NULL) {
    graph_element_destroy(s_graph_element);
    s_graph_element = NULL;
  }
  if (s_sidebar_element != NULL) {
    sidebar_element_destroy(s_sidebar_element);
    s_sidebar_element = NULL;
  }
  if (s_status_bar_element != NULL) {
    status_bar_element_destroy(s_status_bar_element);
    s_status_bar_element = NULL;
  }
  if (s_bg_row_element != NULL) {
    bg_row_element_destroy(s_bg_row_element);
    s_bg_row_element = NULL;
  }

  deinit_layout();
}

static Window *create_main_window() {
  Window *window = window_create();
  window_set_window_handlers(window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload,
  });
  window_stack_push(window, false);
  return window;
}

static void data_callback(DictionaryIterator *received) {
  int msg_type = dict_find(received, APP_KEY_MSG_TYPE)->value->uint8;
  if (msg_type == MSG_TYPE_DATA) {
    if (s_time_element != NULL) {
      time_element_update(s_time_element, received);
    }
    if (s_graph_element != NULL) {
      graph_element_update(s_graph_element, received);
    }
    if (s_sidebar_element != NULL) {
      sidebar_element_update(s_sidebar_element, received);
    }
    if (s_status_bar_element != NULL) {
      status_bar_element_update(s_status_bar_element, received);
    }
    if (s_bg_row_element != NULL) {
      bg_row_element_update(s_bg_row_element, received);
    }
  } else if (msg_type == MSG_TYPE_PREFERENCES) {
    set_prefs(received);
    // recreate the window in case layout preferences have changed
    window_stack_remove(s_window, false);
    window_destroy(s_window);
    s_window = create_main_window();
  }
}

static void init(void) {
  init_prefs();
  init_comm(data_callback);
  s_window = create_main_window();
}

static void deinit(void) {
  window_destroy(s_window);
  deinit_prefs();
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
