#include "config.h"
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

static ElementConfig* get_config_for_element(int element) {
  for(int i = 0; i < s_config->num_elements; i++) {
    if(s_config->elements[i].el == element) {
      return &s_config->elements[i];
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

static Layer* make_layer(Layer *parent, GPoint *pos, ElementConfig *config) {
  int width;
  if (config->w == 0) {
    width = layer_get_bounds(parent).size.w - pos->x;
  } else {
    width = config->w;
  }

  Layer* layer = layer_create_with_data(
    GRect(
      pos->x,
      pos->y,
      width + (config->right ? 1 : 0),
      config->h + (config->bottom ? 1 : 0)
    ),
    sizeof(ElementConfig)
  );

  memcpy(get_element_data(layer), config, sizeof(ElementConfig));
  layer_add_child(parent, layer);
  layer_set_update_proc(layer, draw_borders);

  pos->x += layer_get_bounds(layer).size.w;
  if (pos->x >= layer_get_bounds(parent).size.w) {
    pos->x = 0;
    pos->y += layer_get_bounds(layer).size.h;
  }

  return layer;
}

ElementConfig* get_element_data(Layer* layer) {
  return (ElementConfig*)layer_get_data(layer);
}

LayoutLayers init_layout(Window* window, int layout_option) {
  s_config = layout_config_create(layout_option);
  s_layers = malloc(s_config->num_elements * sizeof(Layer*));

  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  // Time area consumes all height not taken up by other things
  get_config_for_element(TIME_AREA_ELEMENT)->h =
    bounds.size.h
    - get_config_for_element(GRAPH_ELEMENT)->h
    - (get_config_for_element(GRAPH_ELEMENT)->bottom ? 1 : 0)
    - get_config_for_element(STATUS_BAR_ELEMENT)->h
    - (get_config_for_element(STATUS_BAR_ELEMENT)->bottom ? 1 : 0);

  GPoint pos = {.x = 0, .y = 0};
  for(int i = 0; i < s_config->num_elements; i++) {
    s_layers[i] = make_layer(window_layer, &pos, &s_config->elements[i]);
  }

  return (LayoutLayers) {
    .graph = get_layer_for_element(GRAPH_ELEMENT),
    .sidebar = get_layer_for_element(SIDEBAR_ELEMENT),
    .status_bar = get_layer_for_element(STATUS_BAR_ELEMENT),
    .time_area = get_layer_for_element(TIME_AREA_ELEMENT),
  };
}

void deinit_layout() {
  for(int i = 0; i < s_config->num_elements; i++) {
    layer_destroy(s_layers[i]);
  }
  free(s_layers);
  layout_config_destroy(s_config);
}
