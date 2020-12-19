Util = {
    setStyle: (element, styles) => {
        for (let styleName in styles) {
            element.style[styleName] = styles[styleName];
        }
    }
}
