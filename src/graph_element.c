#include "app_keys.h"
#include "config.h"
#include "graph_element.h"
#include "layout.h"
#include "staleness.h"

static int LIMIT_LINES[] = GRAPH_LIMIT_LINES;
static const int GRIDLINES[] = GRAPH_GRIDLINES;

static const int POINT_SIZE = 3;
static const int INTERVAL_SIZE_SECONDS = 5 * 60;

static void plot_point(int x, int y, GContext *ctx) {
  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_rect(ctx, GRect(x, y, POINT_SIZE, POINT_SIZE), 0, GCornerNone);
}

static int bg_to_y(int height, int bg, int min, int max) {
  int y = (float)height - (float)(bg - GRAPH_SGV_MIN) / (float)(GRAPH_SGV_MAX - GRAPH_SGV_MIN) * (float)height - 1.0f;
  if (y < min) {
    y = min;
  } else if (y > max) {
    y = max;
  }
  return y;
}

static int bg_to_y_for_point(int height, int bg) {
  return bg_to_y(height, bg, 0, height - 1 - POINT_SIZE);
}

static int bg_to_y_for_line(int height, int bg) {
  return bg_to_y(height, bg, -1, height - 1);
}

static int staleness_padding() {
  int staleness = total_data_staleness();
  int padding = staleness / INTERVAL_SIZE_SECONDS;
  if (padding == 1 && staleness < INTERVAL_SIZE_SECONDS + GRAPH_STALENESS_GRACE_PERIOD_SECONDS) {
    padding = 0;
  }
  return padding;
}

static void graph_update_proc(Layer *layer, GContext *ctx) {
  unsigned int i, x, y;
  int height = layer_get_bounds(layer).size.h;

  char* bgs = (char*)layer_get_data(layer);
  for(i = 0; i < GRAPH_SGV_COUNT; i++) {
    // XXX: JS divides by 2 to fit into 1 byte
    int bg = bgs[i] * 2;
    if(bg == 0) {
      continue;
    }
    x = POINT_SIZE * (i - staleness_padding());
    y = bg_to_y_for_point(height, bg);
    plot_point(x, y, ctx);
  }

  for(i = 0; i < ARRAY_LENGTH(LIMIT_LINES); i++) {
    y = bg_to_y_for_line(height, LIMIT_LINES[i]);
    for(x = 0; x < POINT_SIZE * GRAPH_SGV_COUNT; x += 4) {
      graphics_draw_line(ctx, GPoint(x, y), GPoint(x + 2, y));
    }
  }

  for(i = 0; i < ARRAY_LENGTH(GRIDLINES); i++) {
    y = bg_to_y_for_line(height, GRIDLINES[i]);
    for(x = 0; x < POINT_SIZE * GRAPH_SGV_COUNT; x += 8) {
      graphics_draw_line(ctx, GPoint(x, y), GPoint(x + 1, y));
    }
  }
}

GraphElement* graph_element_create(Layer *parent) {
  GRect bounds = element_get_bounds(parent);

  Layer* graph_layer = layer_create_with_data(
    GRect(0, 0, bounds.size.w, bounds.size.h),
    GRAPH_SGV_COUNT * sizeof(char)
  );
  layer_set_update_proc(graph_layer, graph_update_proc);
  layer_add_child(parent, graph_layer);

  ConnectionStatusComponent *conn_status = connection_status_component_create(parent, 1, 1);

  GraphElement *el = malloc(sizeof(GraphElement));
  el->graph_layer = graph_layer;
  el->conn_status = conn_status;
  return el;
}

void graph_element_destroy(GraphElement *el) {
  layer_destroy(el->graph_layer);
  connection_status_component_destroy(el->conn_status);
  free(el);
}

void graph_element_update(GraphElement *el, DictionaryIterator *data) {
  memcpy(
    (char*)layer_get_data(el->graph_layer),
    (char*)dict_find(data, APP_KEY_SGVS)->value->cstring,
    GRAPH_SGV_COUNT
  );
  layer_mark_dirty(el->graph_layer);
  connection_status_component_refresh(el->conn_status);
}

void graph_element_tick(GraphElement *el) {
  connection_status_component_refresh(el->conn_status);
}
