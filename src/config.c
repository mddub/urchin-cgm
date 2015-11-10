#include "config.h"

///////////////////////////////////////////////////////
// LAYOUT CONFIGURATION: edit any layout_option_* function
//
// Elements are placed from left to right as long as width
// allows, and then top to bottom. For now, GRAPH_ELEMENT
// and SIDEBAR_ELEMENT should be placed consecutively
// (though either may come first).
//
// A width of 0 means take up all horizontal space remaining
// after the last element that was placed. (If the previous
// element already specified a width of 0, this element will
// start below.)
//
// bottom/right are to toggle borders.

static void layout_option_a(LayoutConfig* dest) {
  int i = 0;
  dest->elements[i++] = (ElementConfig) {
    .el = TIME_AREA_ELEMENT,
    .w = 0,
    // This height has no effect; time area always consumes the leftover height.
    .h = 0,
    .bottom = true,
    .right = false,
  };
  dest->elements[i++] = (ElementConfig) {
    .el = GRAPH_ELEMENT,
    .w = 3 * GRAPH_SGV_COUNT,
    .h = 87,
    .bottom = true,
    .right = true,
  };
  dest->elements[i++] = (ElementConfig) {
    .el = SIDEBAR_ELEMENT,
    .w = 0,
    .h = 87,
    .bottom = true,
    .right = false,
  };
  dest->elements[i++] = (ElementConfig) {
    .el = STATUS_BAR_ELEMENT,
    .w = 0,
    .h = 22,
    .bottom = false,
    .right = false,
  };
  dest->num_elements = i;
}

static void layout_option_b(LayoutConfig* dest) {
  int i = 0;
  dest->elements[i++] = (ElementConfig) {
    .el = GRAPH_ELEMENT,
    .w = 3 * GRAPH_SGV_COUNT,
    .h = 87,
    .bottom = true,
    .right = true,
  };
  dest->elements[i++] = (ElementConfig) {
    .el = SIDEBAR_ELEMENT,
    .w = 0,
    .h = 87,
    .bottom = true,
    .right = false,
  };
  dest->elements[i++] = (ElementConfig) {
    .el = STATUS_BAR_ELEMENT,
    .w = 0,
    .h = 22,
    .bottom = false,
    .right = false,
  };
  dest->elements[i++] = (ElementConfig) {
    .el = TIME_AREA_ELEMENT,
    .w = 0,
    // This height has no effect; time area always consumes the leftover height.
    .h = 0,
    .bottom = false,
    .right = false,
  };
  dest->num_elements = i;
}

///////////////////////////////////////////////////////

LayoutConfig* layout_config_create(int layout_option) {
  LayoutConfig* l_config = malloc(sizeof(LayoutConfig));
  l_config->elements = malloc(MAX_LAYOUT_ELEMENTS * sizeof(ElementConfig));

  if (layout_option == LAYOUT_OPTION_A) {
    layout_option_a(l_config);
  } else if (layout_option == LAYOUT_OPTION_B) {
    layout_option_b(l_config);
  }
  return l_config;
}

void layout_config_destroy(LayoutConfig* l_config) {
  free(l_config->elements);
  free(l_config);
}
