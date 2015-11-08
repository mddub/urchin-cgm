#include "app_keys.h"
#include "row_element.h"

static bool ever_received_data = false;
static time_t last_data_update_time;
static int last_delay_wrt_phone;

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
  text_layer_set_font(data_recency_text, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
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

void row_element_update(RowElement *el, DictionaryIterator *data) {
  ever_received_data = true;
  last_data_update_time = time(NULL);
  last_delay_wrt_phone = dict_find(data, APP_KEY_RECENCY)->value->int32;

  text_layer_set_text(
    el->iob_text,
    dict_find(data, APP_KEY_STATUS_TEXT)->value->cstring
  );
  row_element_tick(el);
}

void row_element_tick(RowElement *el) {
  if (!ever_received_data) {
    return;
  }
  time_t now = time(NULL);
  int phone_min = (now - last_data_update_time) / 60;
  int data_min = phone_min + last_delay_wrt_phone / 60;
  static char s_recency_buffer[16];
  snprintf(s_recency_buffer, sizeof(s_recency_buffer), "(%d/%d)", phone_min, data_min);
  text_layer_set_text(el->data_recency_text, s_recency_buffer);
}
