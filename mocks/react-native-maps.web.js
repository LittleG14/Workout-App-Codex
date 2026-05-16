import React from "react";
import { View } from "react-native";

const MapView = React.forwardRef(function MapView({ children, style }, ref) {
  return React.createElement(View, { style, ref }, children);
});

function Polyline() {
  return null;
}

function Marker() {
  return null;
}

function Circle() {
  return null;
}

const PROVIDER_DEFAULT = null;
const PROVIDER_GOOGLE = "google";

export default MapView;
export { Polyline, Marker, Circle, PROVIDER_DEFAULT, PROVIDER_GOOGLE };
