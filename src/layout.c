#include "fonts.h"
#include "layout.h"

static int s_num_elements;
static Layer** s_layers;
static GSize *s_pixel_sizes;
static TextLayer* s_need_prefs_message;

GColor element_bg(Layer* layer) {
  return get_element_data(layer)->black ? GColorBlack : GColorWhite;
}

GColor element_fg(Layer* layer) {
  return get_element_data(layer)->black ? GColorWhite : GColorBlack;
}

GCompOp element_comp_op(Layer* layer) {
  return get_element_data(layer)->black ? GCompOpSet : GCompOpAnd;
}

static Layer* get_layer_for_element(int element) {
  for(int i = 0; i < get_prefs()->num_elements; i++) {
    if(get_element_data(s_layers[i])->el == element) {
      return s_layers[i];
    }
  }
  return NULL;
}

static void draw_background_and_borders(Layer *layer, GContext *ctx) {
  GRect bounds = layer_get_bounds(layer);
  if (get_element_data(layer)->black) {
    graphics_context_set_fill_color(ctx, element_bg(layer));
    graphics_fill_rect(ctx, GRect(0, 0, bounds.size.w, bounds.size.h), 0, GCornerNone);
  }
  graphics_context_set_stroke_color(ctx, element_fg(layer));
  if (get_element_data(layer)->bottom) {
    graphics_draw_line(ctx, GPoint(0, bounds.size.h - 1), GPoint(bounds.size.w - 1, bounds.size.h - 1));
  }
  if (get_element_data(layer)->right) {
    graphics_draw_line(ctx, GPoint(bounds.size.w - 1, 0), GPoint(bounds.size.w - 1, bounds.size.h - 1));
  }
}

static Layer* position_layer(Layer *parent, GPoint *pos, ElementConfig config, GSize size, bool actually_make_layer) {
  Layer *layer = NULL;
  GSize parent_size = layer_get_bounds(parent).size;

  int width;
  if (size.w == 0) {
    width = parent_size.w - pos->x;
  } else {
    width = size.w;
  }
  width += config.right;
  int height = size.h + config.bottom;

  if (actually_make_layer) {
    layer = layer_create_with_data(
      GRect(pos->x, pos->y, width, height),
      sizeof(ElementConfig)
    );
    memcpy(get_element_data(layer), &config, sizeof(ElementConfig));
    layer_add_child(parent, layer);
    layer_set_update_proc(layer, draw_background_and_borders);
  }

  pos->x += width;
  if (pos->x >= parent_size.w) {
    pos->x = 0;
    pos->y += height;
  }

  return layer;
}

static void compute_pixel_sizes(GSize *result, Layer *parent, ElementConfig *elements) {
  GSize screen_size = layer_get_bounds(parent).size;
  for(int i = 0; i < s_num_elements; i++) {
    result[i].h = (float)screen_size.h * (float)elements[i].h / 100.0f + 0.5f;
    result[i].w = (float)screen_size.w * (float)elements[i].w / 100.0f + 0.5f;
  }
}

static int compute_auto_height(Layer *parent) {
  GPoint pos = {.x = 0, .y = 0};
  int num_rows_auto_height = 0;
  for(int i = 0; i < s_num_elements; i++) {
    num_rows_auto_height += (pos.x == 0 && get_prefs()->elements[i].h == 0);
    position_layer(parent, &pos, get_prefs()->elements[i], s_pixel_sizes[i], false);
  }
  int total_height = layer_get_bounds(parent).size.h;
  int remaining_height = total_height - pos.y;

  return remaining_height / num_rows_auto_height;
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

static TextLayer* maybe_create_need_prefs_message(Layer* parent) {
  if (s_num_elements > 0) {
    return NULL;
  } else {
    TextLayer *t = text_layer_create(layer_get_bounds(parent));
    text_layer_set_text(t, "Urchin CGM\n\nWaiting for settings from phone...");
    text_layer_set_text_alignment(t, GTextAlignmentCenter);
    text_layer_set_background_color(t, GColorClear);
    text_layer_set_text_color(t, GColorBlack);
    text_layer_set_font(t, fonts_get_system_font(get_font(FONT_28_BOLD).key));
    layer_add_child(parent, text_layer_get_layer(t));
    return t;
  }
}

LayoutLayers init_layout(Window* window) {
  s_num_elements = get_prefs()->num_elements;
  s_layers = malloc(s_num_elements * sizeof(Layer*));
  s_pixel_sizes = malloc(s_num_elements * sizeof(GSize));

  Layer *window_layer = window_get_root_layer(window);

  compute_pixel_sizes(s_pixel_sizes, window_layer, get_prefs()->elements);

  int auto_height = compute_auto_height(window_layer);
  for(int i = 0; i < get_prefs()->num_elements; i++) {
    if (s_pixel_sizes[i].h == 0) {
      s_pixel_sizes[i].h = auto_height;
    }
  }

  GPoint pos = {.x = 0, .y = 0};
  for(int i = 0; i < get_prefs()->num_elements; i++) {
    s_layers[i] = position_layer(window_layer, &pos, get_prefs()->elements[i], s_pixel_sizes[i], true);
  }

  s_need_prefs_message = maybe_create_need_prefs_message(window_layer);

  return (LayoutLayers) {
    .graph = get_layer_for_element(GRAPH_ELEMENT),
    .sidebar = get_layer_for_element(SIDEBAR_ELEMENT),
    .status_bar = get_layer_for_element(STATUS_BAR_ELEMENT),
    .time_area = get_layer_for_element(TIME_AREA_ELEMENT),
    .bg_row = get_layer_for_element(BG_ROW_ELEMENT),
  };
}

void deinit_layout() {
  for(int i = 0; i < s_num_elements; i++) {
    layer_destroy(s_layers[i]);
  }
  if (s_need_prefs_message != NULL) {
    text_layer_destroy(s_need_prefs_message);
  }
  free(s_layers);
  free(s_pixel_sizes);
}
