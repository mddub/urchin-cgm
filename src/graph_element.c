#include "app_keys.h"
#include "graph_element.h"

static int LIMIT_LINES[] = {70, 180};
static const int GRIDLINES[] = {50, 100, 150, 200, 250};

static void plot_point(int x, int y, GContext *ctx) {
  graphics_context_set_fill_color(ctx, GColorBlack);
  // treat x as the left boundary and y as the vertical center of the rectangle
  graphics_fill_rect(ctx, GRect(x, y - 1 >= -1 ? y - 1 : -1, 3, 3), 0, GCornerNone);
}

static int y_from_bg(int height, int bg) {
  int y = (float)height - (float)(bg - SGV_MIN) / (float)(SGV_MAX - SGV_MIN) * (float)height - 1.0f;
  if (y < -1) {
    y = -1;
  } else if (y > height - 1) {
    y = height - 1;
  }
  return y;
}

static void graph_update_proc(Layer *layer, GContext *ctx) {
  unsigned int i, x, y;
  int height = layer_get_bounds(layer).size.h;

  char* bgs = (char*)layer_get_data(layer);
  for(i = 0; i < SGV_COUNT; i++) {
    // XXX: JS divides by 2 to fit into 1 byte
    int bg = bgs[i] * 2;
    if(bg == 0) {
      continue;
    }
    x = 3 * i;
    y = y_from_bg(height, bg);
    plot_point(x, y, ctx);
  }

  for(i = 0; i < ARRAY_LENGTH(LIMIT_LINES); i++) {
    y = y_from_bg(height, LIMIT_LINES[i]);
    for(x = 0; x < 3 * SGV_COUNT; x += 4) {
      graphics_draw_line(ctx, GPoint(x, y), GPoint(x + 2, y));
    }
  }

  for(i = 0; i < ARRAY_LENGTH(GRIDLINES); i++) {
    y = y_from_bg(height, GRIDLINES[i]);
    for(x = 0; x < 3 * SGV_COUNT; x += 8) {
      graphics_draw_line(ctx, GPoint(x, y), GPoint(x + 1, y));
    }
  }
}

GraphElement* graph_element_create(Layer *parent) {
  GRect bounds = layer_get_bounds(parent);

  Layer* graph_layer = layer_create_with_data(
    GRect(0, 0, bounds.size.w, bounds.size.h),
    SGV_COUNT * sizeof(char)
  );
  layer_set_update_proc(graph_layer, graph_update_proc);
  layer_add_child(parent, graph_layer);

  GraphElement *el = malloc(sizeof(GraphElement));
  el->graph_layer = graph_layer;
  return el;
}

void graph_element_destroy(GraphElement *el) {
  layer_destroy(el->graph_layer);
  free(el);
}

void graph_element_update(GraphElement *el, DictionaryIterator *data) {
  memcpy(
    (char*)layer_get_data(el->graph_layer),
    (char*)dict_find(data, APP_KEY_SGVS)->value->cstring,
    SGV_COUNT
  );
  layer_mark_dirty(el->graph_layer);
}

void graph_element_tick(GraphElement *el) {}
