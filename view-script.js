const catalogContainer = document.getElementById('catalogContainer');
const categories = ['전체', '미역/미역귀/다시마', '김', '황태', '멸치', '건새우', '오징어(반찬)', '오징어(안주)', '노가리', '안주류', '기타'];

window.addEventListener('load', async function() {
    try {
        const response = await fetch('catalog_data.json');
        if (response.ok) {
            const products = await response.json();
            displayProducts(products);
        } else {
            showError();
        }
    } catch (error) {
        showError();
    }
});

function displayProducts(products) {
    const productsByCategory = {};
    
    categories.forEach(cat => {
        productsByCategory[cat] = [];
    });
    
    // 모든 제품을 '전체'에 추가
    products.forEach(product => {
        if (product.image || product.name) {
            productsByCategory['전체'].push(product);
            
            // 카테고리별로도 추가
            if (product.category && productsByCategory[product.category]) {
                productsByCategory[product.category].push(product);
            }
        }
    });
    
    categories.forEach(category => {
        const categoryProducts = productsByCategory[category];
        
        if (categoryProducts.length > 0) {
            const section = document.createElement('div');
            section.className = 'category-section';
            section.id = `category-${category}`;
            
            const title = document.createElement('div');
            title.className = 'category-title';
            title.textContent = category;
            section.appendChild(title);
            
            const grid = document.createElement('div');
            grid.className = 'catalog-grid';
            
            categoryProducts.forEach(product => {
                const hasImage = product.image && product.image.trim() !== '';
                const hasName = product.name && product.name.trim() !== '';
                
                const card = document.createElement('div');
                card.className = 'product-card';
                card.innerHTML = `
                    <div class="product-image-container">
                        ${hasImage 
                            ? `<img src="${product.image}" alt="${hasName ? product.name : '제품'}" class="product-image" loading="eager">`
                            : `<div class="no-image">이미지 없음</div>`
                        }
                    </div>
                    <div class="product-info">
                        <div class="product-name">
                            ${hasName ? product.name : '제품명 없음'}
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
            
            section.appendChild(grid);
            catalogContainer.appendChild(section);
        }
    });
    
    if (catalogContainer.children.length === 0) {
        showError();
    }
}

function showError() {
    catalogContainer.innerHTML = `
        <div style="text-align: center; padding: 50px;">
            <h2 style="color: #7f8c8d;">데이터를 불러올 수 없습니다</h2>
            <p style="color: #95a5a6; margin-top: 10px;">catalog_data.json 파일을 확인해주세요</p>
        </div>
    `;
}