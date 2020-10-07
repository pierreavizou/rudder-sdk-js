import logger from "../../utils/logUtil";
import { Cookie } from "../../utils/storage/cookie";

class GA {
  constructor(config) {
    this.trackingID = config.trackingID;
    // config.allowLinker = true;
    this.allowLinker = config.allowLinker || false;
    this.name = "GA";
  }

  init() {
    (function(i, s, o, g, r, a, m) {
      i["GoogleAnalyticsObject"] = r;
      (i[r] =
        i[r] ||
        function() {
          (i[r].q = i[r].q || []).push(arguments);
        }),
        (i[r].l = 1 * new Date());
      (a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]);
      a.async = 1;
      a.src = g;
      m.parentNode.insertBefore(a, m);
    })(
      window,
      document,
      "script",
      "https://www.google-analytics.com/analytics.js",
      "ga"
    );

    //window.ga_debug = {trace: true};

    ga("create", this.trackingID, "auto", "rudder_ga", {
      allowLinker: this.allowLinker,
    });

    var userId = Cookie.get('rl_user_id');
    if (userId && userId !== '') {
      ga("rudder_ga.set", "userId", userId);
    }
    //ga("send", "pageview");

    logger.debug("===in init GA===");
  }

  identify(rudderElement) {
    var userId = rudderElement.message.userId !== ''
      ? rudderElement.message.userId
      : rudderElement.message.anonymousId
    ga("rudder_ga.set", "userId", userId);
    logger.debug("in GoogleAnalyticsManager identify");
  }

  track(rudderElement) {
    const self = this;
    // Ecommerce events
    const { event, properties, name } = rudderElement.message;
    const options = this.extractCheckoutOptions(rudderElement);
    const props = rudderElement.message.properties;
    const { products } = properties;
    let { total } = properties;
    const data = {};
    const eventCategory = rudderElement.message.properties.category;
    const orderId = properties.order_id;
    const eventAction = event || name || "";
    const eventLabel = rudderElement.message.properties.label;
    let eventValue = "";
    let payload;
    const { campaign } = rudderElement.message.context;
    let params;
    let filters;
    let sorts;

    this.identify(rudderElement);

    if (event === "Order Completed" && !this.enhancedEcommerce) {
      // order_id is required
      if (!orderId) {
        logger.debug("order_id not present events are not sent to GA");
        return;
      }

      // add transaction
      window.ga("ecommerce:addTransaction", {
        affiliation: properties.affiliation,
        shipping: properties.shipping,
        revenue: total,
        tax: properties.tax,
        id: orderId,
        currency: properties.currency,
      });

      // products added
      products.forEach((product) => {
        const productTrack = self.createProductTrack(rudderElement, product);

        window.ga("ecommerce:addItem", {
          category: productTrack.properties.category,
          quantity: productTrack.properties.quantity,
          price: productTrack.properties.price,
          name: productTrack.properties.name,
          sku: productTrack.properties.sku,
          id: orderId,
          currency: productTrack.properties.currency,
        });
      });

      window.ga("ecommerce:send");
    }

    // enhanced ecommerce events
    else if (this.enhancedEcommerce) {
      switch (event) {
        case "Checkout Started":
        case "Checkout Step Viewed":
        case "Order Updated":
          this.loadEnhancedEcommerce(rudderElement);
          each(products, (product) => {
            let productTrack = self.createProductTrack(rudderElement, product);
            productTrack = { message: productTrack };

            self.enhancedEcommerceTrackProduct(productTrack);
          });

          window.ga("ec:setAction", "checkout", {
            step: properties.step || 1,
            option: options || undefined,
          });

          this.pushEnhancedEcommerce(rudderElement);
          break;
        case "Checkout Step Completed":
          if (!props.step) {
            logger.debug("step not present events are not sent to GA");
            return;
          }
          params = {
            step: props.step || 1,
            option: options || undefined,
          };

          this.loadEnhancedEcommerce(rudderElement);

          window.ga("ec:setAction", "checkout_option", params);
          window.ga("send", "event", "Checkout", "Option");
          break;
        case "Order Completed":
          total =
            rudderElement.message.properties.total ||
            rudderElement.message.properties.revenue ||
            0;

          if (!orderId) {
            logger.debug("order_id not present events are not sent to GA");
            return;
          }
          this.loadEnhancedEcommerce(rudderElement);

          each(products, (product) => {
            let productTrack = self.createProductTrack(rudderElement, product);
            productTrack = { message: productTrack };
            self.enhancedEcommerceTrackProduct(productTrack);
          });
          window.ga("ec:setAction", "purchase", {
            id: orderId,
            affiliation: props.affiliation,
            revenue: total,
            tax: props.tax,
            shipping: props.shipping,
            coupon: props.coupon,
          });

          this.pushEnhancedEcommerce(rudderElement);
          break;
        case "Order Refunded":
          if (!orderId) {
            logger.debug("order_id not present events are not sent to GA");
            return;
          }
          this.loadEnhancedEcommerce(rudderElement);

          each(products, (product) => {
            const track = { properties: product };
            window.ga("ec:addProduct", {
              id:
                track.properties.product_id ||
                track.properties.id ||
                track.properties.sku,
              quantity: track.properties.quantity,
            });
          });

          window.ga("ec:setAction", "refund", {
            id: orderId,
          });

          this.pushEnhancedEcommerce(rudderElement);
          break;
        case "Product Added":
          this.loadEnhancedEcommerce(rudderElement);
          this.enhancedEcommerceTrackProductAction(rudderElement, "add", null);
          this.pushEnhancedEcommerce(rudderElement);
          break;
        case "Product Removed":
          this.loadEnhancedEcommerce(rudderElement);
          this.enhancedEcommerceTrackProductAction(
            rudderElement,
            "remove",
            null
          );
          this.pushEnhancedEcommerce(rudderElement);
          break;
        case "Product Viewed":
          this.loadEnhancedEcommerce(rudderElement);

          if (props.list) data.list = props.list;
          this.enhancedEcommerceTrackProductAction(
            rudderElement,
            "detail",
            data
          );
          this.pushEnhancedEcommerce(rudderElement);
          break;
        case "Product Clicked":
          this.loadEnhancedEcommerce(rudderElement);

          if (props.list) data.list = props.list;
          this.enhancedEcommerceTrackProductAction(
            rudderElement,
            "click",
            data
          );
          this.pushEnhancedEcommerce(rudderElement);
          break;
        case "Promotion Viewed":
          this.loadEnhancedEcommerce(rudderElement);
          window.ga("ec:addPromo", {
            id: props.promotion_id || props.id,
            name: props.name,
            creative: props.creative,
            position: props.position,
          });
          this.pushEnhancedEcommerce(rudderElement);
          break;
        case "Promotion Clicked":
          this.loadEnhancedEcommerce(rudderElement);

          window.ga("ec:addPromo", {
            id: props.promotion_id || props.id,
            name: props.name,
            creative: props.creative,
            position: props.position,
          });
          window.ga("ec:setAction", "promo_click", {});
          this.pushEnhancedEcommerce(rudderElement);
          break;
        case "Product List Viewed":
          this.loadEnhancedEcommerce(rudderElement);

          each(products, (product) => {
            const item = { properties: product };
            if (
              !(item.properties.product_id || item.properties.sku) &&
              !item.properties.name
            ) {
              logger.debug(
                "product_id/sku/name of product not present events are not sent to GA"
              );
              return;
            }
            let impressionObj = {
              id: item.properties.product_id || item.properties.sku,
              name: item.properties.name,
              category: item.properties.category || props.category,
              list: props.list_id || props.category || "products",
              brand: item.properties.band,
              variant: item.properties.variant,
              price: item.properties.price,
              position: self.getProductPosition(item, products),
            };
            impressionObj = {
              ...impressionObj,
              ...self.metricsFunction(
                item.properties,
                self.dimensionsArray,
                self.metricsArray,
                self.contentGroupingsArray
              ),
            };
            Object.keys(impressionObj).forEach((key) => {
              if (impressionObj[key] === undefined) delete impressionObj[key];
            });
            window.ga("ec:addImpression", impressionObj);
          });
          this.pushEnhancedEcommerce(rudderElement);
          break;
        case "Product List Filtered":
          props.filters = props.filters || [];
          props.sorters = props.sorters || [];
          filters = props.filters
            .map((obj) => {
              return `${obj.type}:${obj.value}`;
            })
            .join();
          sorts = props.sorters
            .map((obj) => {
              return `${obj.type}:${obj.value}`;
            })
            .join();

          this.loadEnhancedEcommerce(rudderElement);

          each(products, (product) => {
            const item = { properties: product };

            if (
              !(item.properties.product_id || item.properties.sku) &&
              !item.properties.name
            ) {
              logger.debug(
                "product_id/sku/name of product not present events are not sent to GA"
              );
              return;
            }

            let impressionObj = {
              id: item.properties.product_id || item.sku,
              name: item.name,
              category: item.category || props.category,
              list: props.list_id || props.category || "search results",
              brand: props.brand,
              variant: `${filters}::${sorts}`,
              price: item.price,
              position: self.getProductPosition(item, products),
            };

            impressionObj = {
              impressionObj,
              ...self.metricsFunction(
                item.properties,
                self.dimensionsArray,
                self.metricsArray,
                self.contentGroupingsArray
              ),
            };
            Object.keys(impressionObj).forEach((key) => {
              if (impressionObj[key] === undefined) delete impressionObj[key];
            });
            window.ga("ec:addImpression", impressionObj);
          });
          this.pushEnhancedEcommerce(rudderElement);
          break;
        default:
          if (rudderElement.message.properties) {
            eventValue = rudderElement.message.properties.value
              ? rudderElement.message.properties.value
              : rudderElement.message.properties.revenue;
          }

          payload = {
            eventCategory: eventCategory || "All",
            eventAction,
            eventLabel,
            eventValue: this.formatValue(eventValue),
            // Allow users to override their nonInteraction integration setting for any single particluar event.
            nonInteraction:
              rudderElement.message.properties.nonInteraction !== undefined
                ? !!rudderElement.message.properties.nonInteraction
                : !!this.nonInteraction,
          };

          if (campaign) {
            if (campaign.name) payload.campaignName = campaign.name;
            if (campaign.source) payload.campaignSource = campaign.source;
            if (campaign.medium) payload.campaignMedium = campaign.medium;
            if (campaign.content) payload.campaignContent = campaign.content;
            if (campaign.term) payload.campaignKeyword = campaign.term;
          }

          payload = {
            payload,
            ...this.setCustomDimenionsAndMetrics(
              rudderElement.message.properties
            ),
          };

          window.ga("send", "event", payload.payload);
          logger.debug("in GoogleAnalyticsManager track");
      }
    } else {
      if (rudderElement.message.properties) {
        eventValue = rudderElement.message.properties.value
          ? rudderElement.message.properties.value
          : rudderElement.message.properties.revenue;
      }

      payload = {
        eventCategory: eventCategory || "All",
        eventAction,
        eventLabel,
        eventValue: this.formatValue(eventValue),
        // Allow users to override their nonInteraction integration setting for any single particluar event.
        nonInteraction:
          rudderElement.message.properties.nonInteraction !== undefined
            ? !!rudderElement.message.properties.nonInteraction
            : !!this.nonInteraction,
      };

      if (campaign) {
        if (campaign.name) payload.campaignName = campaign.name;
        if (campaign.source) payload.campaignSource = campaign.source;
        if (campaign.medium) payload.campaignMedium = campaign.medium;
        if (campaign.content) payload.campaignContent = campaign.content;
        if (campaign.term) payload.campaignKeyword = campaign.term;
      }

      payload = {
        payload,
        ...this.setCustomDimenionsAndMetrics(rudderElement.message.properties),
      };

      window.ga("send", "event", payload.payload);
      logger.debug("in GoogleAnalyticsManager track");
    }
  }

  page(rudderElement) {
    logger.debug("in GoogleAnalyticsManager page");
    var path =
      rudderElement.message.properties && rudderElement.message.properties.path
        ? rudderElement.message.properties.path
        : undefined;
    var title = rudderElement.message.properties && rudderElement.message.properties.title
        ? rudderElement.message.properties.title
        : undefined;
    var location = rudderElement.message.properties && rudderElement.message.properties.url
        ? rudderElement.message.properties.url
        : undefined;

    if (path) {
      ga("rudder_ga.set", "page", path);
    }

    if (title) {
      ga("rudder_ga.set", "title", title);
    }

    if (location) {
      ga("rudder_ga.set", "location", location);
    }
<<<<<<< Updated upstream
    ga("rudder_ga.send", "pageview");
    
=======
    window.ga("set", resetCustomDimensions);

    // adds more properties to pageview which will be sent
    pageview = {
      ...pageview,
      ...this.setCustomDimenionsAndMetrics(eventProperties),
    };
    const payload = {
      page: pagePath,
      title: pageTitle,
    };
    logger.debug(pageReferrer);
    logger.debug(document.referrer);
    if (pageReferrer !== document.referrer) payload.referrer = pageReferrer;

    window.ga("set", payload);

    if (this.pageCalled) delete pageview.location;

    this.identify(rudderElement);
    window.ga("send", "pageview", pageview);

    // categorized pages
    // console.log('this.trackCategorizedPages :>> ', this.trackCategorizedPages);
    // if (category && this.trackCategorizedPages) {
    //   this.track(rudderElement, { nonInteraction: 1 });
    // }

    // // named pages
    // console.log('this.trackNamedPages :>> ', this.trackNamedPages);
    // if (name && this.trackNamedPages) {
    //   this.track(rudderElement, { nonInteraction: 1 });
    // }
    this.pageCalled = true;
>>>>>>> Stashed changes
  }

  isLoaded() {
    logger.debug("in GA isLoaded");
    return !!window.gaplugins;
  }

  isReady() {
    return !!window.gaplugins;
  }
}

export { GA };
