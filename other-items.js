// Full product list for the "Other Items" page grouped by category
const otherProductsByCategory = {
  Drinks: [
    { id: 'd1', name: 'Cold Drinks', price: 40, image: 'https://source.unsplash.com/400x300/?cold-drink' },
    { id: 'd2', name: 'Fruit Juice', price: 80, image: 'https://source.unsplash.com/400x300/?fruit-juice' },
    { id: 'd3', name: 'Soda', price: 35, image: 'https://source.unsplash.com/400x300/?soda' },
    { id: 'd4', name: 'Energy Drinks', price: 120, image: 'https://source.unsplash.com/400x300/?energy-drink' },
    { id: 'd5', name: 'Flavored Milk', price: 60, image: 'https://source.unsplash.com/400x300/?flavored-milk' },
    { id: 'd6', name: 'Tea/Coffee Sachets', price: 30, image: 'https://source.unsplash.com/400x300/?tea,coffee' }
  ],
  Snacks: [
    { id: 's1', name: 'Chips', price: 40, image: 'https://source.unsplash.com/400x300/?chips' },
    { id: 's2', name: 'Biscuits', price: 35, image: 'https://source.unsplash.com/400x300/?biscuits' },
    { id: 's3', name: 'Cookies', price: 55, image: 'https://source.unsplash.com/400x300/?cookies' },
    { id: 's4', name: 'Popcorn', price: 70, image: 'https://source.unsplash.com/400x300/?popcorn' },
    { id: 's5', name: 'Khakhra', price: 90, image: 'https://source.unsplash.com/400x300/?khakhra' },
    { id: 's6', name: 'Makhana', price: 120, image: 'https://source.unsplash.com/400x300/?makhana' }
  ],
  'Sweet items': [
    { id: 'w1', name: 'Chocolates', price: 150, image: 'https://source.unsplash.com/400x300/?chocolate' },
    { id: 'w2', name: 'Candy', price: 25, image: 'https://source.unsplash.com/400x300/?candy' },
    { id: 'w3', name: 'Toffees', price: 30, image: 'https://source.unsplash.com/400x300/?toffee' },
    { id: 'w4', name: 'Dry Fruit Sweets', price: 250, image: 'https://source.unsplash.com/400x300/?dry-fruits' }
  ]
};

function renderOtherProducts() {
  // Render into all targets (either on other-items.html or inline on index.html)
  const targets = Array.from(document.querySelectorAll('.other-products-target'));
  if (targets.length === 0) return;

  targets.forEach(container => {
    container.innerHTML = '';

    Object.keys(otherProductsByCategory).forEach(category => {
      const sectionTitle = document.createElement('h2');
      sectionTitle.textContent = category;
      sectionTitle.style.marginTop = '2rem';
      container.appendChild(sectionTitle);

      const grid = document.createElement('div');
      grid.className = 'products';
      grid.style.marginBottom = '1.5rem';

      otherProductsByCategory[category].forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-reveal', '');

        // image wrapper
        const imgWrap = document.createElement('div');
        imgWrap.className = 'product-img-wrapper';
        const img = document.createElement('img');
        img.className = 'product-img';
        img.src = p.image;
        img.alt = p.name;
        img.loading = 'lazy';
        imgWrap.appendChild(img);

        // content
        const title = document.createElement('h3');
        title.textContent = p.name;

        const priceBox = document.createElement('div');
        priceBox.className = 'price-box';
        const priceSpan = document.createElement('span');
        priceSpan.className = 'price';
        priceSpan.textContent = `₹${p.price}`;
        priceBox.appendChild(priceSpan);

        const addBtn = document.createElement('button');
        addBtn.className = 'add-btn';
        addBtn.textContent = 'Add to cart';
        addBtn.addEventListener('click', () => {
          if (typeof addToCart === 'function') {
            addToCart(p.name, p.price);
            addBtn.textContent = 'Added';
            setTimeout(() => (addBtn.textContent = 'Add to cart'), 1200);
          } else {
            alert(p.name + ' — Add to cart not available.');
          }
        });

        // assemble
        card.appendChild(imgWrap);
        card.appendChild(title);
        card.appendChild(priceBox);
        card.appendChild(addBtn);

        grid.appendChild(card);
      });

      container.appendChild(grid);
    });
  });
}

// Expose global renderer so pages can call it after login
window.renderOtherProducts = renderOtherProducts;

document.addEventListener('DOMContentLoaded', renderOtherProducts);
