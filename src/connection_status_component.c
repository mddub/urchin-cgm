#include "comm.h"
#include "connection_status_component.h"
#include "fonts.h"
#include "layout.h"
#include "staleness.h"

#define REASON_ICON_WIDTH 25
#define TEXT_MARGIN_L 1
#define TEXT_MARGIN_ON_OWN_LINE 3
#define REQUEST_STATE_MESSAGE_DURATION_MS 5000
#define CONN_STATUS_FONT FONT_18_BOLD

// This matches STALENESS_REASON_*
const uint32_t CONN_ISSUE_ICONS[] = {
  0,
  RESOURCE_ID_CONN_ISSUE_BLUETOOTH,
  RESOURCE_ID_CONN_ISSUE_NETWORK,
  RESOURCE_ID_CONN_ISSUE_RIG,
};

static FontChoice font;

ConnectionStatusComponent* connection_status_component_create(Layer *parent, int x, int y, bool align_bottom) {
  BitmapLayer *icon_layer = bitmap_layer_create(GRect(x, y, REASON_ICON_WIDTH, REASON_ICON_WIDTH));
  // draw the icon background over the graph
  bitmap_layer_set_compositing_mode(icon_layer, get_element_data(parent)->black ? GCompOpAssignInverted : GCompOpAssign);
  layer_set_hidden(bitmap_layer_get_layer(icon_layer), true);
  layer_add_child(parent, bitmap_layer_get_layer(icon_layer));

  int16_t initial_text_width = element_get_bounds(parent).size.w - x - REASON_ICON_WIDTH - TEXT_MARGIN_L;
  font = get_font(CONN_STATUS_FONT);
  int16_t initial_text_height = 2 * (font.height + font.padding_top + font.padding_bottom);

  TextLayer *reason_text = text_layer_create(GRect(
    x + REASON_ICON_WIDTH + TEXT_MARGIN_L,
    y + (REASON_ICON_WIDTH - font.height) / 2 - font.padding_top,
    initial_text_width,
    initial_text_height
  ));
  text_layer_set_font(reason_text, fonts_get_system_font(font.key));
  text_layer_set_background_color(reason_text, element_bg(parent));
  text_layer_set_text_color(reason_text, element_fg(parent));
  text_layer_set_text_alignment(reason_text, GTextAlignmentLeft);
  layer_set_hidden(text_layer_get_layer(reason_text), true);
  layer_add_child(parent, text_layer_get_layer(reason_text));

  ConnectionStatusComponent *c = malloc(sizeof(ConnectionStatusComponent));
  c->icon_layer = icon_layer;
  c->icon_bitmap = NULL;
  c->reason_text = reason_text;
  c->background = element_bg(parent);
  c->align_bottom = align_bottom;
  c->parent_size = element_get_bounds(parent).size;
  c->initial_x = x;
  c->initial_y = y;
  c->initial_text_width = initial_text_width;
  c->initial_text_height = initial_text_height;
  if (comm_is_update_in_progress()) {
    c->is_showing_request_state = true;
    connection_status_component_show_request_state(c, REQUEST_STATE_WAITING, 0);
  } else {
    c->is_showing_request_state = false;
  }
  return c;
}

void position_icon_and_text(ConnectionStatusComponent *c, GPoint icon_offset, GPoint text_offset) {
  GRect icon_frame = layer_get_frame(bitmap_layer_get_layer(c->icon_layer));
  layer_set_frame(
    bitmap_layer_get_layer(c->icon_layer),
    GRect(c->initial_x + icon_offset.x, c->initial_y + icon_offset.y, icon_frame.size.w, icon_frame.size.h)
  );

  GRect text_frame = layer_get_frame(text_layer_get_layer(c->reason_text));
  layer_set_frame(
    text_layer_get_layer(c->reason_text),
    GRect(c->initial_x + text_offset.x, c->initial_y + text_offset.y, text_frame.size.w, text_frame.size.h)
  );

  c->initial_text_width = c->parent_size.w - text_offset.x;
}

void connection_status_component_update_offset(ConnectionStatusComponent* c, GSize size) {
  if (size.w == 0 && c->align_bottom) {
    position_icon_and_text(c, GPoint(0, 0), GPoint(REASON_ICON_WIDTH + TEXT_MARGIN_L, 0));
  } else if (size.w == 0 && !c->align_bottom) {
    position_icon_and_text(c, GPoint(0, 0), GPoint(REASON_ICON_WIDTH + TEXT_MARGIN_L, 0));
  } else if (c->align_bottom) {
    FontChoice font = get_font(CONN_STATUS_FONT);
    position_icon_and_text(c, GPoint(size.w, 0), GPoint(TEXT_MARGIN_ON_OWN_LINE, -font.height - font.padding_top));
  } else {
    position_icon_and_text(c, GPoint(size.w, 0), GPoint(TEXT_MARGIN_ON_OWN_LINE, size.h));
  }
}

void connection_status_component_destroy(ConnectionStatusComponent *c) {
  text_layer_destroy(c->reason_text);
  if (c->icon_bitmap != NULL) {
    gbitmap_destroy(c->icon_bitmap);
  }
  bitmap_layer_destroy(c->icon_layer);
  free(c);
}

static void _resize_text_frame(ConnectionStatusComponent *c, int16_t width, int16_t height, bool fill_background) {
  // Make the background transparent during the resizing to avoid a flash
  text_layer_set_background_color(c->reason_text, fill_background ? c->background : GColorClear);

  TextLayer *t = c->reason_text;
  GRect frame = layer_get_frame(text_layer_get_layer(t));
  layer_set_frame(
    text_layer_get_layer(t),
    GRect(frame.origin.x, frame.origin.y, width, height)
  );
}

static void _trim_text_frame(void *callback_data) {
  ConnectionStatusComponent *c = callback_data;
  _resize_text_frame(
    c,
    text_layer_get_content_size(c->reason_text).w,
    text_layer_get_content_size(c->reason_text).h,
    true
  );
}

static void fix_text_frame(ConnectionStatusComponent *c) {
  // XXX: need this on Basalt, but not on Aplite or emulator
  _resize_text_frame(c, c->initial_text_width, c->initial_text_height, false);
  layer_mark_dirty(text_layer_get_layer(c->reason_text));
  app_timer_register(100, _trim_text_frame, c);
}

static void clear_request_state(void *callback_data) {
  ConnectionStatusComponent *c = callback_data;
  c->is_showing_request_state = false;
  connection_status_component_tick(c);
}

void connection_status_component_tick(ConnectionStatusComponent *c) {
  if (c->is_showing_request_state) {
    return;
  }

  layer_set_hidden(text_layer_get_layer(c->reason_text), true);

  ConnectionIssue issue = connection_issue();
  if (issue.reason == CONNECTION_ISSUE_NONE) {
    layer_set_hidden(bitmap_layer_get_layer(c->icon_layer), true);
  } else {
    layer_set_hidden(bitmap_layer_get_layer(c->icon_layer), false);
    if (c->icon_bitmap != NULL) {
      gbitmap_destroy(c->icon_bitmap);
    }
    c->icon_bitmap = gbitmap_create_with_resource(CONN_ISSUE_ICONS[issue.reason]);
    bitmap_layer_set_bitmap(c->icon_layer, c->icon_bitmap);
  }
}

void connection_status_component_show_request_state(ConnectionStatusComponent *c, RequestState state, AppMessageResult reason) {
  if (state == REQUEST_STATE_SUCCESS) {
    clear_request_state(c);
    return;
  }

  c->is_showing_request_state = true;

  layer_set_hidden(bitmap_layer_get_layer(c->icon_layer), false);
  if (c->icon_bitmap != NULL) {
    gbitmap_destroy(c->icon_bitmap);
  }
  if (state == REQUEST_STATE_FETCH_ERROR) {
    c->icon_bitmap = gbitmap_create_with_resource(RESOURCE_ID_CONN_ISSUE_NETWORK);
  } else {
    c->icon_bitmap = gbitmap_create_with_resource(RESOURCE_ID_CONN_REFRESHING);
  }
  bitmap_layer_set_bitmap(c->icon_layer, c->icon_bitmap);

  if (state == REQUEST_STATE_WAITING || state == REQUEST_STATE_FETCH_ERROR) {
    layer_set_hidden(text_layer_get_layer(c->reason_text), true);
  } else {
    layer_set_hidden(text_layer_get_layer(c->reason_text), false);

    static char state_text[32];
    switch(state) {
      case REQUEST_STATE_BAD_APP_MESSAGE:   strcpy(state_text, "Bad app msg");    break;
      case REQUEST_STATE_TIMED_OUT:         strcpy(state_text, "Timed out");      break;
      case REQUEST_STATE_NO_BLUETOOTH:      strcpy(state_text, "No BT");          break;
      case REQUEST_STATE_OUT_FAILED:        strcpy(state_text, "Msg failed");     break;
      case REQUEST_STATE_IN_DROPPED:        strcpy(state_text, "Msg dropped");    break;
      case REQUEST_STATE_BEGIN_FAILED:      strcpy(state_text, "Begin failed");   break;
      case REQUEST_STATE_SEND_FAILED:       strcpy(state_text, "Send failed");    break;
      default:                              strcpy(state_text, "Msg error");      break;
    }

    if (reason != 0) {
      static char reason_text[16];
      snprintf(reason_text, sizeof(reason_text), "\nCode %d", reason);
      strcat(state_text, reason_text);
    }

    text_layer_set_text(c->reason_text, state_text);
    fix_text_frame(c);
  }

  if (state != REQUEST_STATE_WAITING) {
    app_timer_register(REQUEST_STATE_MESSAGE_DURATION_MS, clear_request_state, c);
  }
}

uint16_t connection_status_component_size() {
  return REASON_ICON_WIDTH;
}
