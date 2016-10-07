#include "app_messages.h"
#include "fonts.h"
#include "format.h"
#include "layout.h"
#include "preferences.h"
#include "recency_component.h"


RecencyStyle get_style() {
  // NOTE: circles can have odd diameters only
  switch(get_prefs()->recency_style) {
    case RECENCY_STYLE_SMALL_NO_CIRCLE:
      return (RecencyStyle) {.font = FONT_18_BOLD, .diameter = 11, .inset = 0};
    case RECENCY_STYLE_MEDIUM_PIE:
      return (RecencyStyle) {.font = FONT_24_BOLD, .diameter = 21, .inset = 21};
    case RECENCY_STYLE_MEDIUM_RING:
      return (RecencyStyle) {.font = FONT_24_BOLD, .diameter = 21, .inset = 3};
    case RECENCY_STYLE_MEDIUM_NO_CIRCLE:
      return (RecencyStyle) {.font = FONT_24_BOLD, .diameter = 15, .inset = 0};
    case RECENCY_STYLE_LARGE_PIE:
      return (RecencyStyle) {.font = FONT_28_BOLD, .diameter = 29, .inset = 29};
    case RECENCY_STYLE_LARGE_RING:
      return (RecencyStyle) {.font = FONT_28_BOLD, .diameter = 29, .inset = 7};
    case RECENCY_STYLE_LARGE_NO_CIRCLE:
    default:
      return (RecencyStyle) {.font = FONT_28_BOLD, .diameter = 19, .inset = 0};
  }
}

uint16_t recency_component_height() {
  return get_style().diameter + 2 * recency_component_padding();
}

uint16_t recency_component_padding() {
  return 1;
}

static void draw_text(Layer *layer, GContext *ctx, int32_t seconds, bool has_circle, RecencyProps *props) {
  static char string[16];
  format_recency(string, 16, seconds);

  GRect bounds = layer_get_bounds(layer);
  RecencyStyle style = get_style();
  FontChoice font = get_font(style.font);

  int16_t text_width;
  GTextAlignment alignment;
  int16_t content_width = graphics_text_layout_get_content_size(string, fonts_get_system_font(font.key), bounds, GTextOverflowModeWordWrap, GTextAlignmentLeft).w;
  if (content_width <= style.diameter) {
    text_width = style.diameter;
    alignment = GTextAlignmentCenter;
  } else {
    text_width = content_width;
    alignment = GTextAlignmentLeft;
  }

  int16_t text_height = font.padding_top + font.height + font.padding_bottom;
  int16_t text_x = props->align_right ? bounds.size.w - text_width : 0;
  int16_t text_y = (bounds.size.h - font.height) / 2 - font.padding_top;

  GRect text_bounds = (GRect) {
    .origin = GPoint(text_x, text_y),
    .size = GSize(text_width, text_height),
  };

  GSize new_size;
  if (!has_circle) {
    // Draw a background rectangle for legibility
    graphics_context_set_fill_color(ctx, props->parent_bg);
    graphics_fill_rect(ctx, grect_inset(text_bounds, GEdgeInsets(-1)), 0, GCornerNone);
    new_size = GSize(text_bounds.size.w + 1, text_bounds.size.h + 1);
  } else {
    new_size = GSize(style.diameter, style.diameter);
  }

  graphics_context_set_text_color(ctx, get_prefs()->colors[COLOR_KEY_RECENCY_TEXT]);
  graphics_draw_text(ctx, string, fonts_get_system_font(font.key), text_bounds, GTextOverflowModeWordWrap, alignment, NULL);

  if (props->size_changed_callback != NULL) {
    props->size_changed_callback(new_size, props->size_changed_context);
  }
}

static void draw_circle_and_text(Layer *layer, GContext *ctx) {
  if (last_data_message() == NULL) {
    return;
  }

  RecencyStyle style = get_style();
  RecencyProps *props = layer_get_data(layer);

  bool align_right = props->align_right;
  GRect circle_bounds = (GRect) {
    .origin = GPoint(align_right ? layer_get_bounds(layer).size.w - style.diameter : 0, 0),
    .size = GSize(style.diameter, style.diameter),
  };

  int32_t seconds = time(NULL) - last_data_message()->received_at + last_data_message()->recency;
  int32_t minutes = (float)seconds / 60.0f + 0.5f;

  int32_t start = 360 * (minutes - 1) / 5;
  int32_t end = 360;
  bool draw_circle = minutes < 10;

  if (draw_circle) {
    graphics_context_set_fill_color(ctx, props->parent_bg);
    graphics_fill_radial(ctx, circle_bounds, GOvalScaleModeFitCircle, style.diameter, DEG_TO_TRIGANGLE(0), DEG_TO_TRIGANGLE(360));

    graphics_context_set_fill_color(ctx, get_prefs()->colors[COLOR_KEY_RECENCY_CIRCLE]);
    graphics_fill_radial(ctx, circle_bounds, GOvalScaleModeFitCircle, style.inset, DEG_TO_TRIGANGLE(start), DEG_TO_TRIGANGLE(end));
  }

  draw_text(layer, ctx, seconds, draw_circle, props);
}

RecencyComponent* recency_component_create(Layer *parent, uint16_t y, bool align_right, void (*size_changed_callback)(GSize, void*), void *size_changed_context) {
  RecencyComponent *c = malloc(sizeof(RecencyComponent));

  c->circle_layer = layer_create_with_data(
    GRect(
      recency_component_padding(),
      y + recency_component_padding(),
      element_get_bounds(parent).size.w - recency_component_padding() * 2,
      get_style().diameter
    ),
    sizeof(RecencyProps)
  );

  RecencyProps *props = layer_get_data(c->circle_layer);
  props->align_right = align_right;
  props->parent_bg = element_bg(parent);
  props->parent_fg = element_fg(parent);
  props->size_changed_callback = size_changed_callback;
  props->size_changed_context = size_changed_context;

  layer_set_update_proc(c->circle_layer, draw_circle_and_text);
  layer_add_child(parent, c->circle_layer);

  return c;
}

void recency_component_destroy(RecencyComponent *c) {
  layer_destroy(c->circle_layer);
  free(c);
}

void recency_component_tick(RecencyComponent *c) {
  layer_mark_dirty(c->circle_layer);
}
