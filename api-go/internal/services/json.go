package services

import "encoding/json"

// jsonUnmarshal wraps json.Unmarshal to allow testing.
var jsonUnmarshal = json.Unmarshal
