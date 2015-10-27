#include "layout.h"

static Layer** layout;

////////////////////////////////////////////////////////
// TODO init_layout should take this as a parameter

static LayoutElementConfig layout_order[4];

static void do_config() {
  int i = 0;
  layout_order[i++] = (LayoutElementConfig) {
    .el = TIME_AREA_ELEMENT,
    .w = 0,
    // This height has no effect; time area always consumes the leftover height.
    .h = 0,
    .bottom = true,
    .right = false,
  };
  layout_order[i++] = (LayoutElementConfig) {
    .el = GRAPH_ELEMENT,
    .w = 3*36,
    .h = 87,
    .bottom = true,
    .right = true,
  };
  layout_order[i++] = (LayoutElementConfig) {
    .el = SIDEBAR_ELEMENT,
    .w = 0,
    .h = 87,
    .bottom = true,
    .right = false,
  };
  layout_order[i++] = (LayoutElementConfig){
    .el = ROW_ELEMENT,
    .w = 0,
    .h = 22,
    .bottom = true,
    .right = false,
  };
}
////////////////////////////////////////////////////////

static Layer* get_layer_for_element(int element) {
  for(unsigned int i = 0; i < ARRAY_LENGTH(layout_order); i++) {
    LayoutElementConfig* config = (LayoutElementConfig*)layer_get_data(layout[i]);
    if(config->el == element) {
      return layout[i];
    }
  }
  return NULL;
}

static LayoutElementConfig* get_config_for_element(int element) {
  for(unsigned int i = 0; i < ARRAY_LENGTH(layout_order); i++) {
    if(layout_order[i].el == element) {
      return &layout_order[i];
    }
  }
  return NULL;
}

static void draw_borders(Layer *layer, GContext *ctx) {
  GRect bounds = layer_get_bounds(layer);
  graphics_context_set_stroke_color(ctx, GColorBlack);
  LayoutElementConfig *config = (LayoutElementConfig*)layer_get_data(layer);
  if (config->bottom) {
    graphics_draw_line(ctx, GPoint(0, bounds.size.h - 1), GPoint(bounds.size.w - 1, bounds.size.h - 1));
  }
  if (config->right) {
    graphics_draw_line(ctx, GPoint(bounds.size.w - 1, 0), GPoint(bounds.size.w - 1, bounds.size.h - 1));
  }
}

static Layer* make_layer(Layer *parent, GPoint *pos, LayoutElementConfig *config) {
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
    sizeof(LayoutElementConfig)
  );

  memcpy((LayoutElementConfig*)layer_get_data(layer), config, sizeof(LayoutElementConfig));
  layer_add_child(parent, layer);
  layer_set_update_proc(layer, draw_borders);

  pos->x += layer_get_bounds(layer).size.w;
  if (pos->x >= layer_get_bounds(parent).size.w) {
    pos->x = 0;
    pos->y += layer_get_bounds(layer).size.h;
  }

  return layer;
}

LayoutLayers init_layout(Window* window) {
  layout = malloc(4 * sizeof(Layer*));

  do_config();

  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  // Time area consumes all height not taken up by other things
  get_config_for_element(TIME_AREA_ELEMENT)->h =
    bounds.size.h
    - get_config_for_element(GRAPH_ELEMENT)->h
    - (get_config_for_element(GRAPH_ELEMENT)->bottom ? 1 : 0)
    - get_config_for_element(ROW_ELEMENT)->h
    - (get_config_for_element(ROW_ELEMENT)->bottom ? 1 : 0);

  GPoint pos = {.x = 0, .y = 0};
  for(unsigned int i = 0; i < ARRAY_LENGTH(layout_order); i++) {
    layout[i] = make_layer(window_layer, &pos, &layout_order[i]);
  }

  return (LayoutLayers) {
    .graph = get_layer_for_element(GRAPH_ELEMENT),
    .sidebar = get_layer_for_element(SIDEBAR_ELEMENT),
    .row = get_layer_for_element(ROW_ELEMENT),
    .time_area = get_layer_for_element(TIME_AREA_ELEMENT),
  };
}

void deinit_layout() {
  for(unsigned int i = 0; i < ARRAY_LENGTH(layout_order); i++) {
    layer_destroy(layout[i]);
  }
  free(layout);
}
