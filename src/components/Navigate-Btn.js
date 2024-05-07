import React from "react";
import { Trans } from '@herob191/gatsby-plugin-react-i18next';

const NavigateTo = (props) => {
  let cssClassString;

  if(props.class) {
    cssClassString = props.class
  } else {
    cssClassString = 'navigate-btn'
  }

  return(
    <button
      type="button"
      class={`${cssClassString}`}
    >
      <a href={`https://www.google.com/maps/dir/?api=1&destination=${props.lat}%2C${props.lon}`}
        target="_blank"
        rel="noreferrer"
      >
        <Trans>Navigate To</Trans>
      </a>
    </button>
  )
}

export default NavigateTo;


