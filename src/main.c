#include <pebble.h>

#include "app_keys.h"
#include "comm.h"
#include "config.h"
#include "layout.h"
#include "graph_element.h"
#include "preferences.h"
#include "status_bar_element.h"
#include "sidebar_element.h"
#include "time_element.h"

static Window *s_window;

static TimeElement *s_time_element;
static GraphElement *s_graph_element;
static SidebarElement *s_sidebar_element;
static StatusBarElement *s_status_bar_element;

static void data_callback(DictionaryIterator *received) {
  int msg_type = dict_find(received, APP_KEY_MSG_TYPE)->value->uint8;
  if (msg_type == MSG_TYPE_DATA) {
    time_element_update(s_time_element, received);
    status_bar_element_update(s_status_bar_element, received);
    sidebar_element_update(s_sidebar_element, received);
    graph_element_update(s_graph_element, received);
  } else if (msg_type == MSG_TYPE_PREFERENCES) {
    set_prefs(received);
  }
}

static void minute_handler(struct tm *tick_time, TimeUnits units_changed) {
  time_element_tick(s_time_element);
  status_bar_element_tick(s_status_bar_element);
  sidebar_element_tick(s_sidebar_element);
  graph_element_tick(s_graph_element);
}

static void window_load(Window *s_window) {
  LayoutLayers layout = init_layout(s_window, LAYOUT);

  // ensure the time is drawn before anything else
  s_time_element = time_element_create(layout.time_area);
  time_element_tick(s_time_element);

  s_graph_element = graph_element_create(layout.graph);
  s_sidebar_element = sidebar_element_create(layout.sidebar);
  s_status_bar_element = status_bar_element_create(layout.status_bar);

  tick_timer_service_subscribe(MINUTE_UNIT, minute_handler);
}

static void window_unload(Window *s_window) {
  time_element_destroy(s_time_element);
  graph_element_destroy(s_graph_element);
  sidebar_element_destroy(s_sidebar_element);
  status_bar_element_destroy(s_status_bar_element);

  deinit_layout();
}

static void init(void) {
  init_prefs();
  init_comm(data_callback);

  s_window = window_create();
  window_set_window_handlers(s_window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload,
  });
  window_stack_push(s_window, true);
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
