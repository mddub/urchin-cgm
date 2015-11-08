#include "row_element.h"

RowElement* row_element_create(Layer *parent) {
  GRect bounds = layer_get_bounds(parent);

  int sm_text_margin = 2;
  // L- and R-aligned text overlap, so one can be much longer, or nonexistent
  int text_width = bounds.size.w - sm_text_margin;

  TextLayer *iob_text = text_layer_create(GRect(sm_text_margin, 0, text_width, bounds.size.h));
  text_layer_set_text_alignment(iob_text, GTextAlignmentLeft);
  text_layer_set_background_color(iob_text, GColorClear);
  text_layer_set_font(iob_text, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  layer_add_child(parent, text_layer_get_layer(iob_text));

  TextLayer *data_recency_text = text_layer_create(GRect(0, 0, text_width, bounds.size.h));
  text_layer_set_text_alignment(data_recency_text, GTextAlignmentRight);
  text_layer_set_background_color(data_recency_text, GColorClear);
  text_layer_set_font(data_recency_text, fonts_get_system_font(FONT_KEY_GOTHIC_18));
  text_layer_set_text(data_recency_text, "foo");
  layer_add_child(parent, text_layer_get_layer(data_recency_text));

  RowElement *el = malloc(sizeof(RowElement));
  el->iob_text = iob_text;
  el->data_recency_text = data_recency_text;
  return el;
}

void row_element_destroy(RowElement *el) {
  text_layer_destroy(el->iob_text);
  text_layer_destroy(el->data_recency_text);
  free(el);
}
