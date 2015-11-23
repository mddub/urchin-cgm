#include "layout.h"

static LayoutConfig *s_config;
static Layer** s_layers;

static Layer* get_layer_for_element(int element) {
  for(int i = 0; i < s_config->num_elements; i++) {
    if(get_element_data(s_layers[i])->el == element) {
      return s_layers[i];
    }
  }
  return NULL;
}

static void draw_borders(Layer *layer, GContext *ctx) {
  GRect bounds = layer_get_bounds(layer);
  graphics_context_set_stroke_color(ctx, GColorBlack);
  if (get_element_data(layer)->bottom) {
    graphics_draw_line(ctx, GPoint(0, bounds.size.h - 1), GPoint(bounds.size.w - 1, bounds.size.h - 1));
  }
  if (get_element_data(layer)->right) {
    graphics_draw_line(ctx, GPoint(bounds.size.w - 1, 0), GPoint(bounds.size.w - 1, bounds.size.h - 1));
  }
}

static Layer* position_layer(Layer *parent, GPoint *pos, ElementConfig *config, bool actually_make_layer) {
  Layer *layer = NULL;

  int width;
  if (config->w == 0) {
    width = layer_get_bounds(parent).size.w - pos->x;
  } else {
    width = config->w;
  }
  width += config->right;
  int height = config->h + config->bottom;

  if (actually_make_layer) {
    layer = layer_create_with_data(
      GRect(pos->x, pos->y, width, height),
      sizeof(ElementConfig)
    );
    memcpy(get_element_data(layer), config, sizeof(ElementConfig));
    layer_add_child(parent, layer);
    layer_set_update_proc(layer, draw_borders);
  }

  pos->x += width;
  if (pos->x >= layer_get_bounds(parent).size.w) {
    pos->x = 0;
    pos->y += height;
  }

  return layer;
}

static int compute_auto_height(Layer *parent) {
  GPoint pos = {.x = 0, .y = 0};
  for(int i = 0; i < s_config->num_elements; i++) {
    position_layer(parent, &pos, &s_config->elements[i], false);
  }
  int remaining_height = layer_get_bounds(parent).size.h - pos.y;
  int num_elements_auto_height = 0;
  for(int i = 0; i < s_config->num_elements; i++) {
    num_elements_auto_height += s_config->elements[i].h == 0;
  }
  return remaining_height / num_elements_auto_height;
}


ElementConfig* get_element_data(Layer* layer) {
  return (ElementConfig*)layer_get_data(layer);
}

GRect element_get_bounds(Layer* layer) {
  GRect bounds = layer_get_bounds(layer);
  ElementConfig *config = get_element_data(layer);
  if (config->bottom) {
    bounds.size.h--;
  }
  if (config->right) {
    bounds.size.w--;
  }
  return bounds;
}

LayoutLayers init_layout(Window* window, int layout_option) {
  s_config = layout_config_create(layout_option);
  s_layers = malloc(s_config->num_elements * sizeof(Layer*));

  Layer *window_layer = window_get_root_layer(window);

  int auto_height = compute_auto_height(window_layer);
  for(int i = 0; i < s_config->num_elements; i++) {
    if (s_config->elements[i].h == 0) {
      s_config->elements[i].h = auto_height;
    }
  }

  GPoint pos = {.x = 0, .y = 0};
  for(int i = 0; i < s_config->num_elements; i++) {
    s_layers[i] = position_layer(window_layer, &pos, &s_config->elements[i], true);
  }

  return (LayoutLayers) {
    .graph = get_layer_for_element(GRAPH_ELEMENT),
    .sidebar = get_layer_for_element(SIDEBAR_ELEMENT),
    .status_bar = get_layer_for_element(STATUS_BAR_ELEMENT),
    .time_area = get_layer_for_element(TIME_AREA_ELEMENT),
    .bg_row = get_layer_for_element(BG_ROW_ELEMENT),
  };
}

void deinit_layout() {
  for(int i = 0; i < s_config->num_elements; i++) {
    layer_destroy(s_layers[i]);
  }
  free(s_layers);
  layout_config_destroy(s_config);
}
