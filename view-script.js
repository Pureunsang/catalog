const catalogContainer = document.getElementById('catalogContainer');
const categories = ['전체', '미역/미역귀/다시마', '김', '황태', '멸치', '건새우', '오징어(반찬)', '오징어(안주)', '노가리', '안주류', '기타'];
let allProducts = [];
let currentCategory = '전체';

window.addEventListener('load', async function() {
    try {
        const response = await fetch('catalog_data.json');
        if (response.ok) {
            allProducts = await response.json();
            setupCategoryTabs();
            displayCategory('전체');
        } else {
            showError();
        }
    } catch (error) {
        showError();
    }
});

function setupCategoryTabs() {
    const categoryTabs = document.querySelectorAll('.category-tab');
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            const category = this.getAttribute('href').replace('#category-', '');
            displayCategory(category);
            
            // 활성 탭 표시
            categoryTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 맨 위로 스크롤
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
    
    // 첫 로드 시 '전체' 활성화
    if (categoryTabs.length > 0) {
        categoryTabs[0].classList.add('active');
    }
}

function displayCategory(category) {
    currentCategory = category;
    catalogContainer.innerHTML = '';
    
    const productsByCategory = {};
    categories.forEach(cat => {
        productsByCategory[cat] = [];
    });
    
    // 제품 분류
    allProducts.forEach(product => {
        if (product.image || product.name) {
            productsByCategory['전체'].push(product);
            if (product.category && productsByCategory[product.category]) {
                productsByCategory[product.category].push(product);
            }
        }
    });
    
    // 선택된 카테고리 제품 가져오기
    let categoryProducts = productsByCategory[category] || [];
    
    // 가나다순 정렬
    categoryProducts.sort((a, b) => {
        const nameA = (a.name || '').trim();
        const nameB = (b.name || '').trim();
        return nameA.localeCompare(nameB, 'ko');
    });
    
    if (categoryProducts.length > 0) {
        const section = document.createElement('div');
        section.className = 'category-section';
        
        const header = document.createElement('div');
        header.className = 'category-header';
        header.textContent = category;
        section.appendChild(header);
        
        const grid = document.createElement('div');
        grid.className = 'product-grid';
        
        categoryProducts.forEach(product => {
            const hasImage = product.image && product.image.trim() !== '';
            const hasName = product.name && product.name.trim() !== '';
            const rotation = product.rotation || 0;
            
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-image-wrapper">
                    ${hasImage 
                        ? `<img src="${product.image}" alt="${hasName ? product.name : '제품'}" class="product-image" style="transform: rotate(${rotation}deg);" loading="lazy">`
                        : `<div class="no-image">이미지 없음</div>`
                    }
                    ${hasName ? `<div class="product-name-overlay">${product.name}</div>` : ''}
                </div>
            `;
            grid.appendChild(card);
        });
        
        section.appendChild(grid);
        catalogContainer.appendChild(section);
    } else {
        catalogContainer.innerHTML = `
            <div style="text-align: center; padding: 50px;">
                <p style="color: #95a5a6;">이 카테고리에 제품이 없습니다</p>
            </div>
        `;
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
