#include "config.h"
#include "connection_status_component.h"
#include "fonts.h"
#include "layout.h"
#include "staleness.h"

#define REASON_ICON_WIDTH 25
#define INITIAL_TEXT_SIZE 40
#define TEXT_PADDING_R 2

// This matches STALENESS_REASON_*
const int CONN_ISSUE_ICONS[] = {
  NO_ICON,
  RESOURCE_ID_CONN_ISSUE_BLUETOOTH,
  RESOURCE_ID_CONN_ISSUE_NETWORK,
  RESOURCE_ID_CONN_ISSUE_RIG,
};

ConnectionStatusComponent* connection_status_component_create(Layer *parent, int x, int y) {
  BitmapLayer *icon_layer = bitmap_layer_create(GRect(x, y, REASON_ICON_WIDTH, REASON_ICON_WIDTH));
  // draw the icon background over the graph
  bitmap_layer_set_compositing_mode(icon_layer, get_element_data(parent)->black ? GCompOpAssignInverted : GCompOpAssign);
  layer_set_hidden(bitmap_layer_get_layer(icon_layer), true);
  layer_add_child(parent, bitmap_layer_get_layer(icon_layer));

  FontChoice font = get_font(FONT_18_BOLD);
  TextLayer *staleness_text = text_layer_create(GRect(
    x + REASON_ICON_WIDTH + 1,
    y + (REASON_ICON_WIDTH - font.height) / 2 - font.padding_top,
    INITIAL_TEXT_SIZE,
    font.height + font.padding_top + font.padding_bottom
  ));
  text_layer_set_font(staleness_text, fonts_get_system_font(font.key));
  text_layer_set_background_color(staleness_text, element_bg(parent));
  text_layer_set_text_color(staleness_text, element_fg(parent));
  text_layer_set_text_alignment(staleness_text, GTextAlignmentLeft);
  layer_set_hidden(text_layer_get_layer(staleness_text), true);
  layer_add_child(parent, text_layer_get_layer(staleness_text));

  ConnectionStatusComponent *c = malloc(sizeof(ConnectionStatusComponent));
  c->icon_layer = icon_layer;
  c->icon_bitmap = NULL;
  c->staleness_text = staleness_text;
  return c;
}

void connection_status_component_destroy(ConnectionStatusComponent *c) {
  text_layer_destroy(c->staleness_text);
  if (c->icon_bitmap != NULL) {
    gbitmap_destroy(c->icon_bitmap);
  }
  bitmap_layer_destroy(c->icon_layer);
  free(c);
}

static char* staleness_text(int staleness_seconds) {
  static char buf[8];
  int minutes = staleness_seconds / 60;
  int hours = minutes / 60;
  if (minutes < 60) {
    snprintf(buf, sizeof(buf), "%d", minutes);
  } else if (hours < 10) {
    snprintf(buf, sizeof(buf), "%dh%d", hours, minutes - 60 * hours);
  } else if (hours < 100) {
    snprintf(buf, sizeof(buf), "%dh", hours);
  } else {
    strcpy(buf, "!");
  }
  return buf;
}

void connection_status_component_refresh(ConnectionStatusComponent *c) {
  ConnectionIssue issue = connection_issue();
  if (issue.reason == CONNECTION_ISSUE_NONE) {
    layer_set_hidden(bitmap_layer_get_layer(c->icon_layer), true);
    layer_set_hidden(text_layer_get_layer(c->staleness_text), true);
  } else {
    layer_set_hidden(bitmap_layer_get_layer(c->icon_layer), false);
    if (c->icon_bitmap != NULL) {
      gbitmap_destroy(c->icon_bitmap);
    }
    c->icon_bitmap = gbitmap_create_with_resource(CONN_ISSUE_ICONS[issue.reason]);
    bitmap_layer_set_bitmap(c->icon_layer, c->icon_bitmap);

    layer_set_hidden(text_layer_get_layer(c->staleness_text), false);
    text_layer_set_text(c->staleness_text, staleness_text(issue.staleness));

    GRect frame = layer_get_frame(text_layer_get_layer(c->staleness_text));
    layer_set_frame(text_layer_get_layer(c->staleness_text), GRect(
      frame.origin.x,
      frame.origin.y,
      text_layer_get_content_size(c->staleness_text).w + TEXT_PADDING_R,
      frame.size.h
    ));
  }
}
