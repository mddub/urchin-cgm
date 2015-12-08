#include "battery_component.h"
#include "config.h"
#include "layout.h"

#define BATTERY_ICON_WIDTH 24
#define BATTERY_ICON_HEIGHT 22
#define BATTERY_ICON_PADDING 4

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
  if (s_component->icon_bitmap != NULL) {
    gbitmap_destroy(s_component->icon_bitmap);
  }
  s_component->icon_bitmap = gbitmap_create_with_resource(battery_icon_id(charge_state));
  bitmap_layer_set_bitmap(s_component->icon_layer, s_component->icon_bitmap);

  // bitmap_layer_set_bitmap is supposed to trigger this automatically.
  // https://forums.getpebble.com/discussion/comment/129517/#Comment_129517
  layer_mark_dirty(bitmap_layer_get_layer(s_component->icon_layer));
}

int battery_component_width() {
  return BATTERY_ICON_WIDTH;
}

int battery_component_height() {
  return BATTERY_ICON_HEIGHT;
}

int battery_component_vertical_padding() {
  return BATTERY_ICON_PADDING;
}

BatteryComponent* battery_component_create(Layer *parent, int x, int y) {
  battery_state_service_subscribe(battery_handler);

  BitmapLayer *icon_layer = bitmap_layer_create(GRect(x, y, BATTERY_ICON_WIDTH, BATTERY_ICON_HEIGHT));
  bitmap_layer_set_compositing_mode(icon_layer, element_comp_op(parent));
  layer_add_child(parent, bitmap_layer_get_layer(icon_layer));

  BatteryComponent *c = malloc(sizeof(BatteryComponent));
  c->icon_layer = icon_layer;
  c->icon_bitmap = NULL;

  // XXX
  s_component = c;
  battery_handler(battery_state_service_peek());

  return c;
}

void battery_component_destroy(BatteryComponent *c) {
  if (c->icon_bitmap != NULL) {
    gbitmap_destroy(c->icon_bitmap);
  }
  bitmap_layer_destroy(c->icon_layer);
  free(c);
}
