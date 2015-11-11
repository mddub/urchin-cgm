#include "units.h"

void format_bg(char* buffer, char buf_size, int mgdl, bool add_plus_minus, bool use_mmol) {
  char* plus_minus;

  if (add_plus_minus) {
    plus_minus = mgdl >= 0 ? "+" : "-";
    mgdl = (mgdl < 0 ? -1 : 1) * mgdl;
  } else {
    plus_minus = "";
  }

  if (use_mmol) {
    // Pebble snprintf does not support %f:
    // https://forums.getpebble.com/discussion/8743/petition-please-support-float-double-for-snprintf
    int a = mgdl / 18;
    int b = ((float)mgdl - a * 18.0f) / 1.8f + 0.5f;
    if (a == 0 && b == 0) {
      // e.g. "-1 mg/dL" == "+0.0 mmol/L"
      plus_minus = "+";
    }
    snprintf(buffer, buf_size, "%s%d.%d", plus_minus, a, b);
  } else {
    snprintf(buffer, buf_size, "%s%d", plus_minus, mgdl);
  }
}
