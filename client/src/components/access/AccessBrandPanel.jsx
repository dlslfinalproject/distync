import React from "react";
import reliefGoodsBackground from "../../assets/relief-goods-background.jpg";

const AccessBrandPanel = () => (
  <section className="distync-access-page__brand-panel" aria-label="DISTYNC relief goods background">
    <img
      src={reliefGoodsBackground}
      alt=""
      className="distync-access-page__brand-image"
      aria-hidden="true"
    />
  </section>
);

export default AccessBrandPanel;
