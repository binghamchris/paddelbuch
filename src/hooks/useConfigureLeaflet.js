import { useEffect } from "react";
import L from "leaflet";

export default function useConfigureLeaflet() {
  useEffect(() => {
    // To get around an issue with the default icon not being set up right between using React
    // and importing the leaflet library, we need to reset the image imports
    // See https://github.com/PaulLeCam/react-leaflet/issues/453#issuecomment-410450387

    delete L.Icon.Default.prototype._getIconUrl;

    L.Icon.Default.mergeOptions({
      /* iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png").default, 
      iconUrl: require("leaflet/dist/images/marker-icon.png").default, */
      iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",  
      shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    });

    async function fetchImage(url, callback, headers, abort) {
      let _headers = {};
      if (headers) {
        headers.forEach(h => {
          _headers[h.header] = h.value;
        });
      }
      const controller = new AbortController();
      const signal = controller.signal;
      if (abort) {
        abort.subscribe(() => {
          controller.abort();
        });
      }
      const f = await fetch(url, {
        method: "GET",
        headers: _headers,
        mode: "cors",
        signal: signal
      });
      const blob = await f.blob();
      callback(blob);
    }
    
    L.TileLayer.Header = L.TileLayer.extend({
      initialize: function (url, options, headers, abort) {
        L.TileLayer.prototype.initialize.call(this, url, options);
        this.headers = headers;
        this.abort = abort;
      },
      createTile(coords, done) {
        const url = this.getTileUrl(coords);
        const img = document.createElement("img");
        img.setAttribute("role", "presentation");
    
        fetchImage(
          url,
          resp => {
            const reader = new FileReader();
            reader.onload = () => {
              img.src = reader.result;
            };
            reader.readAsDataURL(resp);
            done(null, img);
          },
          this.headers,
          this.abort
        );
        return img;
      }
    });
    
    L.TileLayer.Header = function (url, options, headers, abort) {
      return new L.TileLayer.Header(url, options, headers, abort);
    };

  }, []);
}
