const productCount = 200;
const products = [];

// 이미지 압축 함수
function compressImage(file, maxSizeKB = 200) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // 최대 크기 제한 (긴 쪽을 1920px로)
                const maxDimension = 1920;
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height / width) * maxDimension;
                        width = maxDimension;
                    } else {
                        width = (width / height) * maxDimension;
                        height = maxDimension;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // 압축 품질 조정
                let quality = 0.9;
                const targetSize = maxSizeKB * 1024; // KB를 바이트로 변환
                
                function tryCompress(q) {
                    canvas.toBlob(function(blob) {
                        if (blob.size <= targetSize || q <= 0.1) {
                            // 목표 크기 달성 또는 최소 품질
                            const compressedReader = new FileReader();
                            compressedReader.onload = function(event) {
                                console.log(`원본: ${(file.size / 1024).toFixed(0)}KB → 압축: ${(blob.size / 1024).toFixed(0)}KB`);
                                resolve(event.target.result);
                            };
                            compressedReader.readAsDataURL(blob);
                        } else {
                            // 더 압축 필요
                            tryCompress(q - 0.1);
                        }
                    }, 'image/jpeg', q);
                }
                
                tryCompress(quality);
            };
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}


for (let i = 1; i <= productCount; i++) {
    products.push({ 
        id: i, 
        name: '',
        image: '',
        category: '',
        rotation: 0
    });
}

let catalogGrid;
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', function() {
    catalogGrid = document.getElementById('catalogGrid');
    
    loadInitialData();
    setupFilterButtons();
    
    const bulkUpload = document.getElementById('bulkUpload');
    if (bulkUpload) {
        bulkUpload.addEventListener('change', async function(e) {
            const files = Array.from(e.target.files);
            
            // 비어있는 첫 번째 제품 찾기
            let startIndex = 0;
            for (let i = 0; i < products.length; i++) {
                if (!products[i].image || products[i].image.trim() === '') {
                    startIndex = i;
                    break;
                }
            }
            
            let uploadCount = 0;
            for (let i = 0; i < files.length && (startIndex + i) < products.length; i++) {
                try {
                    const compressedDataUrl = await compressImage(files[i], 200);
                    products[startIndex + i].image = compressedDataUrl;
                    products[startIndex + i].rotation = 0;
                    uploadCount++;
                } catch (error) {
                    console.error(`이미지 ${i + 1} 압축 실패:`, error);
                }
            }
            
            renderProducts();
            alert(`${uploadCount}개 이미지가 제품 ${startIndex + 1}번부터 추가되었습니다!`);
        });
    }
    
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            const dataStr = JSON.stringify(products, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'catalog_data.json';
            link.click();
            URL.revokeObjectURL(url);
            alert('데이터가 저장되었습니다!');
        });
    }
    
    const loadData = document.getElementById('loadData');
    if (loadData) {
        loadData.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        const loadedProducts = JSON.parse(event.target.result);
                        loadedProducts.forEach((product, index) => {
                            if (index < products.length && product) {
                                products[index] = {
                                    id: index + 1,
                                    name: product.name || '',
                                    image: product.image || '',
                                    category: product.category || '',
                                    rotation: product.rotation || 0
                                };
                            }
                        });
                        renderProducts();
                        alert('데이터를 불러왔습니다!');
                    } catch (error) {
                        alert('파일을 읽는 중 오류가 발생했습니다.');
                    }
                };
                reader.readAsText(file);
            }
        });
    }
    
    const viewBtn = document.getElementById('viewBtn');
    if (viewBtn) {
        viewBtn.addEventListener('click', function() {
            window.open('view.html', '_blank');
        });
    }
});

async function loadInitialData() {
    try {
        const response = await fetch('catalog_data.json');
        if (response.ok) {
            const loadedProducts = await response.json();
            loadedProducts.forEach((product, index) => {
                if (index < products.length && product) {
                    products[index] = {
                        id: index + 1,
                        name: product.name || '',
                        image: product.image || '',
                        category: product.category || '',
                        rotation: product.rotation || 0
                    };
                }
            });
            console.log('데이터를 자동으로 불러왔습니다!');
        }
    } catch (error) {
        console.log('저장된 데이터가 없습니다.');
    }
    renderProducts();
}

function setupFilterButtons() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.category;
            renderProducts();
        });
    });
}

function renderProducts() {
    if (!catalogGrid) return;
    
    catalogGrid.innerHTML = '';
    
    const filteredProducts = currentFilter === 'all' 
        ? products 
        : products.filter(p => p.category === currentFilter);
    
    filteredProducts.forEach(product => {
        const card = createProductCard(product);
        catalogGrid.appendChild(card);
    });
    
    console.log('제품 렌더링 완료:', filteredProducts.length, '개');
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.productId = product.id;
    
    const rotation = product.rotation || 0;
    
    card.innerHTML = `
        <div class="product-number">제품 ${product.id}</div>
        <div class="product-image-container" id="container-${product.id}">
            <img src="${product.image || ''}" alt="제품 ${product.id}" class="product-image" id="img-${product.id}" style="display: ${product.image ? 'block' : 'none'}; transform: rotate(${rotation}deg);">
            <div class="image-upload-btn" id="btn-${product.id}" style="display: ${product.image ? 'none' : 'block'};">📷 이미지 선택</div>
            <div class="image-controls" id="controls-${product.id}" style="display: ${product.image ? 'flex' : 'none'};">
                <div class="rotate-btn" id="rotate-${product.id}">↻</div>
                <div class="delete-image-btn" id="delete-${product.id}">✕</div>
            </div>
        </div>
        <input type="file" id="file-${product.id}" class="file-input" accept="image/*">
        <div class="product-info">
            <div class="product-name">
                <input type="text" placeholder="제품명을 입력하세요" id="name-${product.id}" value="${product.name || ''}">
            </div>
            <div class="product-category">
                <span class="category-label">카테고리</span>
                <select id="category-${product.id}">
                    <option value="">선택하세요</option>
                    <option value="미역/미역귀/다시마" ${product.category === '미역/미역귀/다시마' ? 'selected' : ''}>미역/미역귀/다시마</option>
                    <option value="김" ${product.category === '김' ? 'selected' : ''}>김</option>
                    <option value="황태" ${product.category === '황태' ? 'selected' : ''}>황태</option>
                    <option value="멸치" ${product.category === '멸치' ? 'selected' : ''}>멸치</option>
                    <option value="건새우" ${product.category === '건새우' ? 'selected' : ''}>건새우</option>
                    <option value="오징어(반찬)" ${product.category === '오징어(반찬)' ? 'selected' : ''}>오징어(반찬)</option>
                    <option value="오징어(안주)" ${product.category === '오징어(안주)' ? 'selected' : ''}>오징어(안주)</option>
                    <option value="노가리" ${product.category === '노가리' ? 'selected' : ''}>노가리</option>
                    <option value="안주류" ${product.category === '안주류' ? 'selected' : ''}>안주류</option>
                    <option value="기타" ${product.category === '기타' ? 'selected' : ''}>기타</option>
                </select>
            </div>
        </div>
    `;
    
    setupCardEvents(card, product);
    return card;
}

function setupCardEvents(card, product) {
    console.log('이벤트 설정 중:', product.id);
    const container = card.querySelector(`#container-${product.id}`);
    const fileInput = card.querySelector(`#file-${product.id}`);
    const nameInput = card.querySelector(`#name-${product.id}`);
    const categorySelect = card.querySelector(`#category-${product.id}`);
    const rotateBtn = card.querySelector(`#rotate-${product.id}`);
    const deleteBtn = card.querySelector(`#delete-${product.id}`);
    
    // 드래그 앤 드롭 기능 추가
    card.setAttribute('draggable', 'true');
    
    card.addEventListener('dragstart', function(e) {
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', card.innerHTML);
    });
    
    card.addEventListener('dragend', function(e) {
        card.classList.remove('dragging');
        
        // 모든 카드의 drag-over 클래스 제거
        document.querySelectorAll('.product-card').forEach(c => {
            c.classList.remove('drag-over');
        });
    });
    
    card.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const draggingCard = document.querySelector('.dragging');
        if (draggingCard && draggingCard !== card) {
            card.classList.add('drag-over');
        }
        return false;
    });
    
    card.addEventListener('dragleave', function(e) {
        card.classList.remove('drag-over');
    });
    
    card.addEventListener('drop', function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        const draggingCard = document.querySelector('.dragging');
        if (draggingCard && draggingCard !== card) {
            // 제품 데이터 교환
            const fromId = parseInt(draggingCard.dataset.productId);
            const toId = parseInt(card.dataset.productId);
            
            const tempProduct = {...products[fromId - 1]};
            products[fromId - 1] = {...products[toId - 1]};
            products[toId - 1] = tempProduct;
            
            // ID는 유지
            products[fromId - 1].id = fromId;
            products[toId - 1].id = toId;
            
            renderProducts();
        }
        
        card.classList.remove('drag-over');
        return false;
    });
    
    if (container) {
        container.addEventListener('click', function(e) {
            if (!e.target.closest('.rotate-btn') && !e.target.closest('.delete-image-btn')) {
                fileInput.click();
            }
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    // 이미지 압축
                    const compressedDataUrl = await compressImage(file, 200);
                    
                    const img = card.querySelector(`#img-${product.id}`);
                    const btn = card.querySelector(`#btn-${product.id}`);
                    const controls = card.querySelector(`#controls-${product.id}`);
                    img.src = compressedDataUrl;
                    img.style.display = 'block';
                    btn.style.display = 'none';
                    controls.style.display = 'flex';
                    products[product.id - 1].image = compressedDataUrl;
                    products[product.id - 1].rotation = 0;
                    img.style.transform = 'rotate(0deg)';
                } catch (error) {
                    console.error('이미지 압축 실패:', error);
                    alert('이미지 처리 중 오류가 발생했습니다.');
                }
            }
        });
    }
    
    if (rotateBtn) {
        rotateBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const img = card.querySelector(`#img-${product.id}`);
            const currentRotation = products[product.id - 1].rotation || 0;
            const newRotation = (currentRotation + 90) % 360;
            products[product.id - 1].rotation = newRotation;
            img.style.transform = `rotate(${newRotation}deg)`;
        });
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const deleteIndex = product.id - 1;
            
            // 해당 제품부터 끝까지 한 칸씩 당기기
            for (let i = deleteIndex; i < products.length - 1; i++) {
                products[i] = {
                    id: i + 1,
                    name: products[i + 1].name,
                    image: products[i + 1].image,
                    category: products[i + 1].category,
                    rotation: products[i + 1].rotation
                };
            }
            
            // 맨 마지막 제품은 비우기
            products[products.length - 1] = {
                id: products.length,
                name: '',
                image: '',
                category: '',
                rotation: 0
            };
            
            renderProducts();
        });
    }
    
    if (nameInput) {
        nameInput.addEventListener('input', function(e) {
            products[product.id - 1].name = e.target.value;
        });
    }
    
    if (categorySelect) {
        categorySelect.addEventListener('change', function(e) {
            products[product.id - 1].category = e.target.value;
        });
    }
}
