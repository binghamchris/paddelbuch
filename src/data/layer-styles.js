import * as colour from 'data/paddelbuch-colours';

export const lakeStyle = {
  color: colour.secondaryBlue,
  weight: 2,
  fill: false
}

export const protectedAreaStyle = {
  color: colour.warningYellow,
  weight: 2,
  fill: true,
  fillOpacity: 0.6,
  dashArray: "12 9",
}

export const obstacleStyle = {
  color: colour.dangerRed,
  weight: 2,
  fill: true,
  fillOpacity: 0.8,
  lineJoin: "bevel",
  lineCap: "butt,"
}

export const portageStyle = {
  color: colour.routesPurple,
  weight: 4,
  fill: false,
  dashArray: "15 9 1 9",
  lineJoin: "arcs",
}