#include <pebble.h>

#include "comm.h"
#include "layout.h"
#include "graph_element.h"
#include "row_element.h"
#include "sidebar_element.h"
#include "time_element.h"

static Window *s_window;

static TimeElement *s_time_element;
static GraphElement *s_graph_element;
static SidebarElement *s_sidebar_element;
static RowElement *s_row_element;

static void data_callback(DictionaryIterator *received) {
  time_element_update(s_time_element, received);
  row_element_update(s_row_element, received);
  sidebar_element_update(s_sidebar_element, received);
  graph_element_update(s_graph_element, received);

}

static void minute_handler(struct tm *tick_time, TimeUnits units_changed) {
  time_element_tick(s_time_element);
  row_element_tick(s_row_element);
  sidebar_element_tick(s_sidebar_element);
  graph_element_tick(s_graph_element);
}

static void window_load(Window *s_window) {
  LayoutLayers layout = init_layout(s_window);

  // ensure the time is drawn before anything else
  s_time_element = time_element_create(layout.time_area);
  time_element_tick(s_time_element);

  s_graph_element = graph_element_create(layout.graph);
  s_sidebar_element = sidebar_element_create(layout.sidebar);
  s_row_element = row_element_create(layout.row);

  tick_timer_service_subscribe(MINUTE_UNIT, minute_handler);
}

static void window_unload(Window *s_window) {
  time_element_destroy(s_time_element);
  graph_element_destroy(s_graph_element);
  sidebar_element_destroy(s_sidebar_element);
  row_element_destroy(s_row_element);

  deinit_layout();
}

static void init(void) {
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
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
