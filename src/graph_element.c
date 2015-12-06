#include "app_keys.h"
#include "config.h"
#include "graph_element.h"
#include "layout.h"
#include "preferences.h"
#include "staleness.h"

#ifdef PBL_SDK_3
static GPoint point_segments[GRAPH_MAX_SGV_COUNT+1];
static GPathInfo bg_path_info = {
  .num_points = 0,
  .points = point_segments
};
#endif

static void plot_point(int x, int y, GContext *ctx) {
  graphics_fill_rect(ctx, GRect(x, y, GRAPH_POINT_SIZE, GRAPH_POINT_SIZE), 0, GCornerNone);
}

static int bg_to_y(int height, int bg, int min, int max, bool fit_in_bounds) {
  // Graph lower bound, graph upper bound
  int graph_min = get_prefs()->bottom_of_graph;
  int graph_max = get_prefs()->top_of_graph;
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
  return bg_to_y(height, bg, 0, height - GRAPH_POINT_SIZE, true);
}

static int bg_to_y_for_line(int height, int bg) {
  return bg_to_y(height, bg, -1, height - 1, false);
}

#ifdef PBL_SDK_2
void draw_graph_sdk2(GContext *ctx, GSize *size, GraphData *data, int padding) {
  int i, x, y;
  for(i = 0; i < data->count; i++) {
    // XXX: JS divides by 2 to fit into 1 byte
    int bg = data->sgvs[i] * 2;
    if(bg == 0) {
      continue;
    }
    x = size->w - GRAPH_POINT_SIZE * (1 + i + padding);
    y = bg_to_y_for_point(size->h, bg);
    plot_point(x, y, ctx);
  }
}
#endif

#ifdef PBL_SDK_3
void draw_graph_sdk3(GContext *ctx, GSize *size, GraphData *data,
                  int padding) {
  int i;
  int segment_start = 0;
  bg_path_info.num_points = 0;
  graphics_context_set_stroke_width(ctx, 3);
  for(i = 0; i < data->count && (unsigned int) i <= GRAPH_MAX_SGV_COUNT; i++) {
    // XXX: JS divides by 2 to fit into 1 byte
    int bg = data->sgvs[i] * 2;
    if(bg == 0) {
      if (segment_start != i) {
        bg_path_info.points = &point_segments[segment_start];
        GPath *path = gpath_create(&bg_path_info);
        gpath_draw_outline_open(ctx, path);
        gpath_destroy(path);
      }
      segment_start = i+1;
      bg_path_info.num_points = 0;
      continue;
    }
    point_segments[i].x = size->w - GRAPH_POINT_SIZE * (1 + i + padding);
    point_segments[i].y = bg_to_y_for_point(size->h, bg);
    bg_path_info.num_points += 1;
  }
  bg_path_info.points = &point_segments[segment_start];
  GPath *path = gpath_create(&bg_path_info);
  gpath_draw_outline_open(ctx, path);
  gpath_destroy(path);
}
#endif

static void graph_update_proc(Layer *layer, GContext *ctx) {
  int i, x, y;
  GSize size = layer_get_bounds(layer).size;

  GraphData *data = layer_get_data(layer);
  graphics_context_set_stroke_color(ctx, data->color);
  graphics_context_set_fill_color(ctx, data->color);

  int padding = graph_staleness_padding();
  graphics_context_set_fill_color(ctx, GColorBlack);

#ifdef PBL_SDK_3
  draw_graph_sdk3(ctx, &size, data, padding);
#endif
#ifdef PBL_SDK_2
  draw_graph_sdk2(ctx, &size, data, padding);
#endif
  // Target range bounds
  uint16_t limits[2] = {get_prefs()->top_of_range, get_prefs()->bottom_of_range};
  bool is_top[2] = {true, false};
  for(i = 0; i < (int)ARRAY_LENGTH(limits); i++) {
    y = bg_to_y_for_line(size.h, limits[i]);
    for(x = 0; x < size.w; x += 2) {
      graphics_draw_pixel(ctx, GPoint(x + 1, y - 1));
      graphics_draw_pixel(ctx, GPoint(x, y));
      graphics_draw_pixel(ctx, GPoint(x + 1, y + 1));
      // Draw bounds symmetrically, on the inside of the range
      if (is_top[i]) {
        graphics_draw_pixel(ctx, GPoint(x, y + 2));
      } else {
        graphics_draw_pixel(ctx, GPoint(x, y - 2));
      }
    }
  }

  // Horizontal gridlines
#ifdef PBL_SDK_3
  graphics_context_set_stroke_width(ctx, 1);
#endif
  int h_gridline_frequency = get_prefs()->h_gridlines;
  if (h_gridline_frequency > 0) {
    int graph_min = get_prefs()->bottom_of_graph;
    int graph_max = get_prefs()->top_of_graph;
    for(int g = 0; g < graph_max; g += h_gridline_frequency) {
      if (g <= graph_min || g == limits[0] || g == limits[1]) {
        continue;
      }
      y = bg_to_y_for_line(size.h, g);
      for(x = 2; x < size.w; x += 8) {
        graphics_draw_line(ctx, GPoint(x, y), GPoint(x + 1, y));
      }
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
  ((GraphData*)layer_get_data(graph_layer))->sgvs = malloc(GRAPH_MAX_SGV_COUNT * sizeof(char));
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
    (char*)dict_find(data, APP_KEY_SGVS)->value->cstring,
    count * sizeof(char)
  );
  layer_mark_dirty(el->graph_layer);
  connection_status_component_refresh(el->conn_status);
}

void graph_element_tick(GraphElement *el) {
  connection_status_component_refresh(el->conn_status);
}
