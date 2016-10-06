#include "graph_element.h"
#include "layout.h"
#include "preferences.h"
#include "staleness.h"

#define BOLUS_TICK_HEIGHT 7
#define NO_BG 32767

static GPoint center_of_point(int x, int y) {
  if (get_prefs()->point_shape == POINT_SHAPE_CIRCLE) {
    return GPoint(x + get_prefs()->point_width / 2, y + get_prefs()->point_width / 2);
  } else {
    return GPoint(x + get_prefs()->point_width / 2, y + get_prefs()->point_rect_height / 2);
  }
}

static void plot_point(int x, int y, GColor c, GContext *ctx) {
  graphics_context_set_fill_color(ctx, c);
  if (get_prefs()->point_shape == POINT_SHAPE_RECTANGLE) {
    graphics_fill_rect(ctx, GRect(x, y, get_prefs()->point_width, get_prefs()->point_rect_height), 0, GCornerNone);
  } else if (get_prefs()->point_shape == POINT_SHAPE_CIRCLE) {
    graphics_fill_circle(ctx, center_of_point(x, y), get_prefs()->point_width / 2);
  }
}

static void plot_tick(int x, int bottom_y, GContext *ctx) {
  uint8_t width;
  if (get_prefs()->point_width >= 5 && get_prefs()->point_width % 2 == 1) {
    width = 3;
  } else {
    width = 2;
  }
  graphics_fill_rect(ctx, GRect(x + get_prefs()->point_width / 2 - width / 2, bottom_y - BOLUS_TICK_HEIGHT, width, BOLUS_TICK_HEIGHT), 0, GCornerNone);
}

static int bg_to_y(int height, int bg) {
  // Graph lower bound, graph upper bound
  int graph_min = get_prefs()->bottom_of_graph;
  int graph_max = get_prefs()->top_of_graph;
  return (float)height - (float)(bg - graph_min) / (float)(graph_max - graph_min) * (float)height + 0.5f;
}

static int index_to_x(uint8_t i, uint8_t graph_width, uint8_t padding) {
  return graph_width - (get_prefs()->point_width + get_prefs()->point_margin) * (1 + i + padding) + get_prefs()->point_margin - get_prefs()->point_right_margin;
}

static int bg_to_y_for_point(int height, int bg) {
  int min = 0;
  int diameter = get_prefs()->point_shape == POINT_SHAPE_CIRCLE ? get_prefs()->point_width : get_prefs()->point_rect_height;
  int max = height - diameter;

  int y = (float)bg_to_y(height, bg) - diameter / 2.0f + 0.5f;
  if (y < min) {
    return min;
  } else if (y > max) {
    return max;
  } else {
    return y;
  }
}

static GColor color_for_bg(int bg) {
  if (bg > get_prefs()->top_of_range) {
    return get_prefs()->colors[COLOR_KEY_POINT_HIGH];
  } else if (bg < get_prefs()->bottom_of_range) {
    return get_prefs()->colors[COLOR_KEY_POINT_LOW];
  } else {
    return get_prefs()->colors[COLOR_KEY_POINT_DEFAULT];
  }
}

static void fill_rect_gray(GContext *ctx, GRect bounds, GColor previous_color) {
  graphics_context_set_fill_color(ctx, GColorLightGray);
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);
  graphics_context_set_fill_color(ctx, previous_color);
}

static uint8_t decode_bits(uint8_t value, uint8_t offset, uint8_t bits) {
  return (value >> offset) & (0xff >> (8 - bits));
}

static uint8_t sgv_graph_height(int16_t available_height) {
  return get_prefs()->basal_graph ? available_height - get_prefs()->basal_height : available_height;
}

static void graph_update_proc(Layer *layer, GContext *ctx) {
  int i, x, y;
  GSize layer_size = layer_get_bounds(layer).size;
  uint8_t graph_width = layer_size.w;
  uint8_t graph_height = sgv_graph_height(layer_size.h);

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

  // Line and point preprocessing
  static GPoint to_plot[GRAPH_MAX_SGV_COUNT];
  int16_t bg;
  for(i = 0; i < data->count; i++) {
    // XXX: JS divides by 2 to fit into 1 byte
    bg = data->sgvs[i] * 2;
    if(bg == 0) {
      continue;
    }
    x = index_to_x(i, graph_width, padding);
    y = bg_to_y_for_point(graph_height, bg);
    to_plot[i] = GPoint(x, y);
    // stop plotting if the SGV is off-screen
    if (x < 0) {
      break;
    }
  }
  uint8_t plot_count = i;

  // Line
  if (get_prefs()->plot_line) {
    graphics_context_set_stroke_width(ctx, get_prefs()->plot_line_width);
    int16_t last_bg = NO_BG;
    GPoint last_center;
    for(i = 0; i < plot_count; i++) {
      bg = data->sgvs[i] * 2;
      if (bg == 0) {
        continue;
      }
      GPoint center = center_of_point(to_plot[i].x, to_plot[i].y);
      if (last_bg != NO_BG) {
        if (get_prefs()->plot_line_is_custom_color) {
          graphics_context_set_stroke_color(ctx, COLOR_FALLBACK(get_prefs()->colors[COLOR_KEY_PLOT_LINE], data->color));
        } else {
          graphics_context_set_stroke_color(ctx, COLOR_FALLBACK(color_for_bg(last_bg), data->color));
        }
        graphics_draw_line(ctx, center, last_center);
      }
      last_bg = bg;
      last_center = center;
    }
    graphics_context_set_stroke_width(ctx, 1);
  }

  // Points
  for(i = 0; i < plot_count; i++) {
    bg = data->sgvs[i] * 2;
    if (bg != 0) {
      plot_point(to_plot[i].x, to_plot[i].y, COLOR_FALLBACK(color_for_bg(bg), data->color), ctx);
    }
  }

  graphics_context_set_fill_color(ctx, data->color);
  graphics_context_set_stroke_color(ctx, data->color);

  // Boluses
  for(i = 0; i < data->count; i++) {
    bool bolus = decode_bits(data->extra[i], GRAPH_EXTRA_BOLUS_OFFSET, GRAPH_EXTRA_BOLUS_BITS);
    if (bolus) {
      x = index_to_x(i, graph_width, padding);
      plot_tick(x, graph_height, ctx);
    }
  }

  // Basals
  if (get_prefs()->basal_graph) {
    graphics_draw_line(ctx, GPoint(0, graph_height), GPoint(graph_width, graph_height));
    for(i = 0; i < data->count; i++) {
      uint8_t basal = decode_bits(data->extra[i], GRAPH_EXTRA_BASAL_OFFSET, GRAPH_EXTRA_BASAL_BITS);
      x = index_to_x(i, graph_width, padding);
      y = layer_size.h - basal;
      uint8_t width = get_prefs()->point_width + get_prefs()->point_margin;
      if (i == data->count - 1 && x >= 0) {
        // if this is the last point to draw, extend its basal data to the left edge
        width += x;
        x = 0;
      }
      graphics_draw_line(ctx, GPoint(x, y), GPoint(x + width - 1, y));
      if (basal > 1) {
        fill_rect_gray(ctx, GRect(x, y + 1, width, basal - 1), data->color);
      }
    }
    if (padding > 0) {
      x = index_to_x(padding - 1, graph_width, 0);
      graphics_fill_rect(ctx, GRect(x, graph_height, graph_width - x, get_prefs()->basal_height), 0, GCornerNone);
    }
  }
}

static void recency_size_changed(GSize size, void *context) {
  connection_status_component_update_offset((ConnectionStatusComponent*)context, size);
}

GraphElement* graph_element_create(Layer *parent) {
  GraphElement *el = malloc(sizeof(GraphElement));

  GRect bounds = element_get_bounds(parent);

  el->graph_layer = layer_create_with_data(
    GRect(0, 0, bounds.size.w, bounds.size.h),
    sizeof(GraphData)
  );
  ((GraphData*)layer_get_data(el->graph_layer))->color = element_fg(parent);
  ((GraphData*)layer_get_data(el->graph_layer))->sgvs = malloc(GRAPH_MAX_SGV_COUNT * sizeof(uint8_t));
  ((GraphData*)layer_get_data(el->graph_layer))->extra = malloc(GRAPH_MAX_SGV_COUNT * sizeof(uint8_t));
  layer_set_update_proc(el->graph_layer, graph_update_proc);
  layer_add_child(parent, el->graph_layer);

  el->conn_status = NULL;
  int16_t conn_status_y = -1;
  bool conn_status_align_bottom;
  if (get_prefs()->conn_status_loc == CONN_STATUS_LOC_GRAPH_TOP_LEFT) {
    conn_status_align_bottom = false;
    conn_status_y = 1;
  } else if (get_prefs()->conn_status_loc == CONN_STATUS_LOC_GRAPH_BOTTOM_LEFT) {
    conn_status_align_bottom = true;
    conn_status_y = bounds.size.h - connection_status_component_size();
  }
  if (conn_status_y != -1) {
    el->conn_status = connection_status_component_create(parent, 0, conn_status_y, conn_status_align_bottom);
  }

  el->recency = NULL;
  int16_t recency_y = -1;
  if (get_prefs()->recency_loc == RECENCY_LOC_GRAPH_TOP_LEFT) {
    recency_y = 1;
  } else if (get_prefs()->recency_loc == RECENCY_LOC_GRAPH_BOTTOM_LEFT) {
    recency_y = bounds.size.h - recency_component_size();
  }
  if (recency_y != -1) {
    if (
        (get_prefs()->recency_loc == RECENCY_LOC_GRAPH_TOP_LEFT && get_prefs()->conn_status_loc == CONN_STATUS_LOC_GRAPH_TOP_LEFT) ||
        (get_prefs()->recency_loc == RECENCY_LOC_GRAPH_BOTTOM_LEFT && get_prefs()->conn_status_loc == CONN_STATUS_LOC_GRAPH_BOTTOM_LEFT)
    ) {
      // XXX: If the recency component and connection status component share the
      // same corner, the connection status must subscribe to changes in the
      // width of the recency to decide the x position of the icon.
      el->recency = recency_component_create(parent, recency_y, false, recency_size_changed, el->conn_status);
    } else {
      el->recency = recency_component_create(parent, recency_y, false, NULL, NULL);
    }
  }

  return el;
}

void graph_element_destroy(GraphElement *el) {
  free(((GraphData*)layer_get_data(el->graph_layer))->sgvs);
  free(((GraphData*)layer_get_data(el->graph_layer))->extra);
  layer_destroy(el->graph_layer);
  if (el->conn_status != NULL) {
    connection_status_component_destroy(el->conn_status);
  }
  if (el->recency != NULL) {
    recency_component_destroy(el->recency);
  }
  free(el);
}

void graph_element_update(GraphElement *el, DataMessage *data) {
  GraphData *graph_data = layer_get_data(el->graph_layer);
  graph_data->count = data->sgv_count;
  memcpy(graph_data->sgvs, data->sgvs, data->sgv_count * sizeof(uint8_t));
  memcpy(graph_data->extra, data->graph_extra, data->sgv_count * sizeof(uint8_t));
  graph_element_tick(el);
}

void graph_element_tick(GraphElement *el) {
  layer_mark_dirty(el->graph_layer);
  if (el->conn_status != NULL) {
    connection_status_component_tick(el->conn_status);
  }
  if (el->recency != NULL) {
    recency_component_tick(el->recency);
  }
}

void graph_element_show_request_state(GraphElement *el, RequestState state, AppMessageResult reason) {
  if (el->conn_status != NULL) {
    connection_status_component_show_request_state(el->conn_status, state, reason);
  }
}
