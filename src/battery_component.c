#include "battery_component.h"
#include "config.h"
#include "fonts.h"
#include "layout.h"
#include "preferences.h"

#define BATTERY_ICON_WIDTH 24
#define BATTERY_ICON_HEIGHT 22
#define BATTERY_ICON_PADDING 4
#define BATTERY_ICON_TOP_FUDGE 1

#define BATTERY_TEXT_WIDTH 50
#define BATTERY_FONT FONT_18_BOLD

// XXX need to keep reference to this for battery_handler
static BatteryComponent *s_component;

static int battery_icon_id(BatteryChargeState charge_state) {
  if (charge_state.is_charging) {
    return RESOURCE_ID_BATTERY_CHARGING;
  } else if (charge_state.charge_percent <= 10) {
    return RESOURCE_ID_BATTERY_10;
  } else if (charge_state.charge_percent <= 20) {
    return RESOURCE_ID_BATTERY_25;
  } else if (charge_state.charge_percent <= 50) {
    return RESOURCE_ID_BATTERY_50;
  } else if (charge_state.charge_percent <= 80) {
    return RESOURCE_ID_BATTERY_75;
  } else {
    return RESOURCE_ID_BATTERY_100;
  }
}

static void battery_handler(BatteryChargeState charge_state) {
  if (get_prefs()->battery_as_number) {

    if (charge_state.is_charging) {
      text_layer_set_text(s_component->text_layer, "+%");
    } else {
      static char battery_text[8];
      snprintf(battery_text, sizeof(battery_text), "%d%%", charge_state.charge_percent);
      text_layer_set_text(s_component->text_layer, battery_text);
    }
    layer_mark_dirty(text_layer_get_layer(s_component->text_layer));

  } else {

    if (s_component->icon_bitmap != NULL) {
      gbitmap_destroy(s_component->icon_bitmap);
    }
    s_component->icon_bitmap = gbitmap_create_with_resource(battery_icon_id(charge_state));
    bitmap_layer_set_bitmap(s_component->icon_layer, s_component->icon_bitmap);

    // bitmap_layer_set_bitmap is supposed to trigger this automatically.
    // https://forums.getpebble.com/discussion/comment/129517/#Comment_129517
    layer_mark_dirty(bitmap_layer_get_layer(s_component->icon_layer));

  }
}

int battery_component_width() {
  return get_prefs()->battery_as_number ? BATTERY_TEXT_WIDTH : BATTERY_ICON_WIDTH;
}

int battery_component_height() {
  return get_prefs()->battery_as_number ? get_font(BATTERY_FONT).height + 2 * get_font(BATTERY_FONT).padding_bottom : BATTERY_ICON_HEIGHT;
}

int battery_component_vertical_padding() {
  return get_prefs()->battery_as_number ? get_font(BATTERY_FONT).padding_bottom : BATTERY_ICON_PADDING;
}

BatteryComponent* battery_component_create(Layer *parent, int x, int y, bool align_right) {
  battery_state_service_subscribe(battery_handler);

  BatteryComponent *c = malloc(sizeof(BatteryComponent));
  c->icon_layer = NULL;
  c->icon_bitmap = NULL;
  c->text_layer = NULL;

  if (get_prefs()->battery_as_number) {

    FontChoice font = get_font(BATTERY_FONT);
    c->text_layer = text_layer_create(GRect(x, y - font.padding_top + font.padding_bottom, BATTERY_TEXT_WIDTH, font.height + font.padding_top + font.padding_bottom));
    text_layer_set_text_alignment(c->text_layer, align_right ? GTextAlignmentRight : GTextAlignmentLeft);
    text_layer_set_background_color(c->text_layer, GColorClear);
    text_layer_set_text_color(c->text_layer, element_fg(parent));
    text_layer_set_font(c->text_layer, fonts_get_system_font(font.key));
    layer_add_child(parent, text_layer_get_layer(c->text_layer));

  } else {

    c->icon_layer = bitmap_layer_create(GRect(x, y + BATTERY_ICON_TOP_FUDGE, BATTERY_ICON_WIDTH, BATTERY_ICON_HEIGHT));
    bitmap_layer_set_compositing_mode(c->icon_layer, element_comp_op(parent));
    layer_add_child(parent, bitmap_layer_get_layer(c->icon_layer));

  }

  // XXX
  s_component = c;
  battery_handler(battery_state_service_peek());

  return c;
}

void battery_component_destroy(BatteryComponent *c) {
  if (c->icon_bitmap != NULL) {
    gbitmap_destroy(c->icon_bitmap);
  }
  if (c->icon_layer != NULL) {
    bitmap_layer_destroy(c->icon_layer);
  }
  if (c->text_layer != NULL) {
    text_layer_destroy(c->text_layer);
  }
  free(c);
}
