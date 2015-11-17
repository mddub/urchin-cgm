#include "app_keys.h"
#include "config.h"
#include "graph_element.h"
#include "layout.h"
#include "preferences.h"
#include "staleness.h"

static const int POINT_SIZE = 3;

static void plot_point(int x, int y, GContext *ctx) {
  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_rect(ctx, GRect(x, y, POINT_SIZE, POINT_SIZE), 0, GCornerNone);
}

static int bg_to_y(int height, int bg, int min, int max, bool fit_in_bounds) {
  // Graph lower bound, graph upper bound
  int graph_min = get_prefs()->glb;
  int graph_max = get_prefs()->gub;
  int y = (float)height - (float)(bg - graph_min) / (float)(graph_max - graph_min) * (float)height - 1.0f;
  if (fit_in_bounds) {
    if (y < min) {
      y = min;
    } else if (y > max) {
      y = max;
    }
  }
  return y;
}

static int bg_to_y_for_point(int height, int bg) {
  return bg_to_y(height, bg, 0, height - 1 - POINT_SIZE, true);
}

static int bg_to_y_for_line(int height, int bg) {
  return bg_to_y(height, bg, -1, height - 1, false);
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
    x = POINT_SIZE * (i - graph_staleness_padding());
    y = bg_to_y_for_point(height, bg);
    plot_point(x, y, ctx);
  }

  // Graph high limit, graph low limit
  uint16_t limits[2] = {get_prefs()->ghl, get_prefs()->gll};
  for(i = 0; i < ARRAY_LENGTH(limits); i++) {
    y = bg_to_y_for_line(height, limits[i]);
    for(x = 0; x < POINT_SIZE * GRAPH_SGV_COUNT; x += 4) {
      graphics_draw_line(ctx, GPoint(x, y), GPoint(x + 2, y));
    }
  }

  // Horizontal gridlines
  int h_gridline_frequency = get_prefs()->hgl;
  if (h_gridline_frequency > 0) {
    int graph_min = get_prefs()->glb;
    int graph_max = get_prefs()->gub;
    for(int g = 0; g < graph_max; g += h_gridline_frequency) {
      if (g <= graph_min || g == limits[0] || g == limits[1]) {
        continue;
      }
      y = bg_to_y_for_line(height, g);
      for(x = 0; x < POINT_SIZE * GRAPH_SGV_COUNT; x += 8) {
        graphics_draw_line(ctx, GPoint(x, y), GPoint(x + 1, y));
      }
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
