#include "app_keys.h"
#include "row_element.h"

static bool ever_received_data = false;
static time_t last_data_update_time;
static int last_delay_wrt_phone;

StatusBarElement* status_bar_element_create(Layer *parent) {
  GRect bounds = layer_get_bounds(parent);

  int sm_text_margin = 2;
  // L- and R-aligned text overlap, so one can be much longer, or nonexistent
  int text_width = bounds.size.w - sm_text_margin;

  TextLayer *left_text = text_layer_create(GRect(sm_text_margin, 0, text_width, bounds.size.h));
  text_layer_set_text_alignment(left_text, GTextAlignmentLeft);
  text_layer_set_background_color(left_text, GColorClear);
  text_layer_set_font(left_text, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_overflow_mode(left_text, GTextOverflowModeWordWrap);
  layer_add_child(parent, text_layer_get_layer(left_text));

  TextLayer *right_text = text_layer_create(GRect(0, 0, text_width, bounds.size.h));
  text_layer_set_text_alignment(right_text, GTextAlignmentRight);
  text_layer_set_background_color(right_text, GColorClear);
  text_layer_set_font(right_text, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
  text_layer_set_overflow_mode(right_text, GTextOverflowModeWordWrap);
  layer_add_child(parent, text_layer_get_layer(right_text));

  StatusBarElement *el = malloc(sizeof(StatusBarElement));
  el->left_text = left_text;
  el->right_text = right_text;
  return el;
}

void status_bar_element_destroy(StatusBarElement *el) {
  text_layer_destroy(el->left_text);
  text_layer_destroy(el->right_text);
  free(el);
}

void status_bar_element_update(StatusBarElement *el, DictionaryIterator *data) {
  ever_received_data = true;
  last_data_update_time = time(NULL);
  last_delay_wrt_phone = dict_find(data, APP_KEY_RECENCY)->value->int32;

  text_layer_set_text(
    el->left_text,
    dict_find(data, APP_KEY_STATUS_TEXT)->value->cstring
  );
  status_bar_element_tick(el);
}

// TODO: for now, the right status always shows the recency of the data
void status_bar_element_tick(StatusBarElement *el) {
  if (!ever_received_data) {
    return;
  }
  time_t now = time(NULL);
  int phone_min = (now - last_data_update_time) / 60;
  int data_min = phone_min + last_delay_wrt_phone / 60;
  static char s_recency_buffer[16];
  snprintf(s_recency_buffer, sizeof(s_recency_buffer), "(%d/%d)", phone_min, data_min);
  text_layer_set_text(el->right_text, s_recency_buffer);
}
