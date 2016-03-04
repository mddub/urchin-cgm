#include "app_keys.h"
#include "config.h"
#include "graph_element.h"
#include "layout.h"
#include "preferences.h"
#include "staleness.h"

static void plot_point(int x, int y, GContext *ctx) {
  graphics_fill_rect(ctx, GRect(x, y, GRAPH_POINT_SIZE, GRAPH_POINT_SIZE), 0, GCornerNone);
}

static void plot_tick(int x, int bottom_y, GContext *ctx) {
  graphics_fill_rect(ctx, GRect(x, bottom_y - BOLUS_TICK_HEIGHT, BOLUS_TICK_WIDTH, BOLUS_TICK_HEIGHT), 0, GCornerNone);
}

static int bg_to_y(int height, int bg) {
  // Graph lower bound, graph upper bound
  int graph_min = get_prefs()->bottom_of_graph;
  int graph_max = get_prefs()->top_of_graph;
  return (float)height - (float)(bg - graph_min) / (float)(graph_max - graph_min) * (float)height + 0.5f;
}

static int bg_to_y_for_point(int height, int bg) {
  int min = 0;
  int max = height - GRAPH_POINT_SIZE;

  int y = (float)bg_to_y(height, bg) - GRAPH_POINT_SIZE / 2.0f + 0.5f;
  if (y < min) {
    return min;
  } else if (y > max) {
    return max;
  } else {
    return y;
  }
}

static void fill_rect_gray(GContext *ctx, GRect bounds, GColor previous_color) {
#ifdef PBL_COLOR
  graphics_context_set_fill_color(ctx, GColorLightGray);
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);
  graphics_context_set_fill_color(ctx, previous_color);
#else
  // XXX: remove this after migrating to SDK 3.8+
  for(uint8_t x = bounds.origin.x; x < bounds.origin.x + bounds.size.w; x++) {
    for(uint8_t y = bounds.origin.y; y < bounds.origin.y + bounds.size.h; y++) {
      if ((x + y) % 2 == 0) {
        graphics_draw_pixel(ctx, GPoint(x, y));
      }
    }
  }
#endif
}

static uint8_t decode_bits(uint8_t value, uint8_t offset, uint8_t bits) {
  return (value >> offset) & (0xff >> (8 - bits));
}

static void graph_update_proc(Layer *layer, GContext *ctx) {
  int i, x, y;
  GSize layer_size = layer_get_bounds(layer).size;
  uint8_t graph_width = layer_size.w;
  uint8_t graph_height = get_prefs()->basal_graph ? layer_size.h - get_prefs()->basal_height : layer_size.h;

  GraphData *data = layer_get_data(layer);
  graphics_context_set_stroke_color(ctx, data->color);
  graphics_context_set_fill_color(ctx, data->color);
  int padding = graph_staleness_padding();

  // Target range bounds
  uint16_t limits[2] = {get_prefs()->top_of_range, get_prefs()->bottom_of_range};
  bool is_top[2] = {true, false};
  for(i = 0; i < (int)ARRAY_LENGTH(limits); i++) {
    y = bg_to_y(graph_height, limits[i]);
    for(x = 0; x < graph_width; x += 2) {
      // Draw bounds symmetrically, on the inside of the range
      if (is_top[i]) {
        fill_rect_gray(ctx, GRect(0, y - 1, graph_width, 4), data->color);
      } else {
        fill_rect_gray(ctx, GRect(0, y - 2, graph_width, 4), data->color);
      }
    }
  }

  // Horizontal gridlines
  int h_gridline_frequency = get_prefs()->h_gridlines;
  if (h_gridline_frequency > 0) {
    int graph_min = get_prefs()->bottom_of_graph;
    int graph_max = get_prefs()->top_of_graph;
    for(int g = 0; g < graph_max; g += h_gridline_frequency) {
      if (g <= graph_min || g == limits[0] || g == limits[1]) {
        continue;
      }
      y = bg_to_y(graph_height, g);
      for(x = 2; x < graph_width; x += 8) {
        graphics_draw_line(ctx, GPoint(x, y), GPoint(x + 1, y));
      }
    }
  }

  // SGVs
  for(i = 0; i < data->count; i++) {
    // XXX: JS divides by 2 to fit into 1 byte
    int bg = data->sgvs[i] * 2;
    if(bg == 0) {
      continue;
    }
    x = graph_width - GRAPH_POINT_SIZE * (1 + i + padding);
    y = bg_to_y_for_point(graph_height, bg);
    plot_point(x, y, ctx);
  }

  // Boluses
  for(i = 0; i < data->count; i++) {
    bool bolus = decode_bits(data->extra[i], GRAPH_EXTRA_BOLUS_OFFSET, GRAPH_EXTRA_BOLUS_BITS);
    if (bolus) {
      x = graph_width - GRAPH_POINT_SIZE * (1 + i + padding);
      plot_tick(x, graph_height, ctx);
    }
  }

  // Basals
  if (get_prefs()->basal_graph) {
    graphics_draw_line(ctx, GPoint(0, graph_height), GPoint(graph_width, graph_height));
    for(i = 0; i < data->count; i++) {
      uint8_t basal = decode_bits(data->extra[i], GRAPH_EXTRA_BASAL_OFFSET, GRAPH_EXTRA_BASAL_BITS);
      x = graph_width - GRAPH_POINT_SIZE * (1 + i + padding);
      y = layer_size.h - basal;
      graphics_draw_line(ctx, GPoint(x, y), GPoint(x + GRAPH_POINT_SIZE - 1, y));
      if (basal > 1) {
        fill_rect_gray(ctx, GRect(x, y + 1, GRAPH_POINT_SIZE, basal - 1), data->color);
      }
    }
    if (padding > 0) {
      x = graph_width - GRAPH_POINT_SIZE * padding - 1;
      graphics_fill_rect(ctx, GRect(x, graph_height, graph_width - x, get_prefs()->basal_height), 0, GCornerNone);
    }
  }
}

GraphElement* graph_element_create(Layer *parent) {
  GRect bounds = element_get_bounds(parent);

  Layer* graph_layer = layer_create_with_data(
    GRect(0, 0, bounds.size.w, bounds.size.h),
    sizeof(GraphData)
  );
  ((GraphData*)layer_get_data(graph_layer))->color = element_fg(parent);
  ((GraphData*)layer_get_data(graph_layer))->sgvs = malloc(GRAPH_MAX_SGV_COUNT * sizeof(uint8_t));
  ((GraphData*)layer_get_data(graph_layer))->extra = malloc(GRAPH_MAX_SGV_COUNT * sizeof(uint8_t));
  layer_set_update_proc(graph_layer, graph_update_proc);
  layer_add_child(parent, graph_layer);

  ConnectionStatusComponent *conn_status = connection_status_component_create(parent, 1, 1);

  GraphElement *el = malloc(sizeof(GraphElement));
  el->graph_layer = graph_layer;
  el->conn_status = conn_status;
  return el;
}

void graph_element_destroy(GraphElement *el) {
  free(((GraphData*)layer_get_data(el->graph_layer))->sgvs);
  free(((GraphData*)layer_get_data(el->graph_layer))->extra);
  layer_destroy(el->graph_layer);
  connection_status_component_destroy(el->conn_status);
  free(el);
}

void graph_element_update(GraphElement *el, DictionaryIterator *data) {
  int count = dict_find(data, APP_KEY_SGV_COUNT)->value->int32;
  count = count > GRAPH_MAX_SGV_COUNT ? GRAPH_MAX_SGV_COUNT : count;
  ((GraphData*)layer_get_data(el->graph_layer))->count = count;
  memcpy(
    ((GraphData*)layer_get_data(el->graph_layer))->sgvs,
    (uint8_t*)dict_find(data, APP_KEY_SGVS)->value->data,
    count * sizeof(uint8_t)
  );
  memcpy(
    ((GraphData*)layer_get_data(el->graph_layer))->extra,
    (uint8_t*)dict_find(data, APP_KEY_GRAPH_EXTRA)->value->data,
    count * sizeof(uint8_t)
  );
  layer_mark_dirty(el->graph_layer);
  connection_status_component_refresh(el->conn_status);
}

void graph_element_tick(GraphElement *el) {
  connection_status_component_refresh(el->conn_status);
}
