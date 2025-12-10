const productCount = 200;
const products = [];

// 이미지를 Blob으로 변환하는 함수
function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

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
                const targetSize = maxSizeKB * 1024;
                
                function tryCompress(q) {
                    canvas.toBlob(function(blob) {
                        if (blob.size <= targetSize || q <= 0.1) {
                            const compressedReader = new FileReader();
                            compressedReader.onload = function(event) {
                                console.log(`원본: ${(file.size / 1024).toFixed(0)}KB → 압축: ${(blob.size / 1024).toFixed(0)}KB`);
                                resolve({
                                    dataUrl: event.target.result,
                                    blob: blob
                                });
                            };
                            compressedReader.readAsDataURL(blob);
                        } else {
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

// Firebase에 이미지 업로드
async function uploadImageToFirebase(blob, productId) {
    const { storageRef, uploadBytes, getDownloadURL } = window.firebaseRefs;
    const storage = window.firebaseStorage;
    
    const imageRef = storageRef(storage, `products/${productId}.jpg`);
    await uploadBytes(imageRef, blob);
    const url = await getDownloadURL(imageRef);
    return url;
}

// Firebase에서 데이터 로드
async function loadFromFirebase() {
    const { ref, get } = window.firebaseRefs;
    const database = window.firebaseDB;
    
    try {
        const snapshot = await get(ref(database, 'products'));
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(key => {
                const index = parseInt(key);
                if (index >= 0 && index < products.length) {
                    products[index] = {
                        id: index + 1,
                        name: data[key].name || '',
                        image: data[key].imageUrl || '',
                        category: data[key].category || '',
                        rotation: data[key].rotation || 0
                    };
                }
            });
            renderProducts();
            alert('Firebase에서 데이터를 불러왔습니다!');
        } else {
            console.log('Firebase에 저장된 데이터가 없습니다.');
        }
    } catch (error) {
        console.error('Firebase 로드 에러:', error);
        alert('데이터 로드 실패: ' + error.message);
    }
}

// Firebase에 데이터 저장
async function saveToFirebase() {
    const { ref, set } = window.firebaseRefs;
    const database = window.firebaseDB;
    
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = '💾 저장 중...';
    
    try {
        // 이미지가 있는 제품만 필터링
        const productsToSave = {};
        let uploadCount = 0;
        
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            if (product.image || product.name) {
                let imageUrl = product.image;
                
                // Base64 이미지인 경우 Firebase Storage에 업로드
                if (product.image && product.image.startsWith('data:')) {
                    saveBtn.textContent = `💾 저장 중... (${uploadCount + 1}개)`;
                    const blob = dataURLtoBlob(product.image);
                    imageUrl = await uploadImageToFirebase(blob, i);
                    uploadCount++;
                }
                
                productsToSave[i] = {
                    name: product.name,
                    category: product.category,
                    rotation: product.rotation,
                    imageUrl: imageUrl
                };
            }
        }
        
        // Realtime Database에 저장
        await set(ref(database, 'products'), productsToSave);
        
        // 로컬 products 업데이트 (imageUrl로 변경)
        Object.keys(productsToSave).forEach(key => {
            const index = parseInt(key);
            products[index].image = productsToSave[key].imageUrl;
        });
        
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Firebase 저장';
        alert(`Firebase에 ${uploadCount}개 이미지와 데이터가 저장되었습니다!`);
    } catch (error) {
        console.error('Firebase 저장 에러:', error);
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Firebase 저장';
        alert('저장 실패: ' + error.message);
    }
}

// 제품 배열 초기화
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
    
    // Firebase에서 데이터 로드
    loadFromFirebase();
    setupFilterButtons();
    
    // 일괄 업로드
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
                    const compressed = await compressImage(files[i], 200);
                    products[startIndex + i].image = compressed.dataUrl;
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
    
    // Firebase 저장 버튼
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveToFirebase);
    }
    
    // JSON 데이터 불러오기
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
                        alert('데이터를 불러왔습니다! 이제 Firebase 저장 버튼을 눌러주세요.');
                    } catch (error) {
                        console.error('JSON 파싱 에러:', error);
                        alert('파일 형식이 올바르지 않습니다.');
                    }
                };
                reader.readAsText(file);
            }
        });
    }
    
    // 카탈로그 보기
    const viewBtn = document.getElementById('viewBtn');
    if (viewBtn) {
        viewBtn.addEventListener('click', function() {
            window.open('view.html', '_blank');
        });
    }
    
    renderProducts();
});

function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.getAttribute('data-category');
            renderProducts();
        });
    });
}

function renderProducts() {
    if (!catalogGrid) return;
    
    catalogGrid.innerHTML = '';
    
    products.forEach((product, index) => {
        if (currentFilter !== 'all' && product.category !== currentFilter) {
            return;
        }
        
        const card = createProductCard(product, index);
        catalogGrid.appendChild(card);
    });
}

function createProductCard(product, index) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.draggable = true;
    card.dataset.index = index;
    
    card.innerHTML = `
        <div class="product-number">제품 ${product.id}</div>
        <div class="product-image-container">
            ${product.image ? 
                `<img src="${product.image}" class="product-image" style="transform: rotate(${product.rotation}deg);">
                 <div class="image-controls">
                    <div class="rotate-btn" data-index="${index}">↻</div>
                    <div class="delete-image-btn" data-index="${index}">✕</div>
                 </div>` 
                : 
                `<div class="image-upload-btn">이미지 선택</div>
                 <input type="file" class="file-input" accept="image/*" data-index="${index}">`
            }
        </div>
        <div class="product-info">
            <div class="product-name">
                <input type="text" placeholder="제품명 입력" value="${product.name}" data-index="${index}" class="name-input">
            </div>
            <div class="product-category">
                <span class="category-label">카테고리</span>
                <select data-index="${index}" class="category-select">
                    <option value="">선택</option>
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
    
    // 이미지 업로드
    const fileInput = card.querySelector('.file-input');
    if (fileInput) {
        fileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    const compressed = await compressImage(file, 200);
                    products[index].image = compressed.dataUrl;
                    products[index].rotation = 0;
                    renderProducts();
                } catch (error) {
                    console.error('이미지 압축 실패:', error);
                    alert('이미지 처리 실패');
                }
            }
        });
    }
    
    // 이미지 컨테이너 클릭
    const imageContainer = card.querySelector('.product-image-container');
    if (imageContainer && !product.image) {
        imageContainer.addEventListener('click', function() {
            const input = this.querySelector('.file-input');
            if (input) input.click();
        });
    }
    
    // 회전 버튼
    const rotateBtn = card.querySelector('.rotate-btn');
    if (rotateBtn) {
        rotateBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            products[index].rotation = (products[index].rotation + 90) % 360;
            renderProducts();
        });
    }
    
    // 이미지 삭제 버튼
    const deleteBtn = card.querySelector('.delete-image-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm('이미지를 삭제하시겠습니까?')) {
                products[index].image = '';
                products[index].rotation = 0;
                renderProducts();
            }
        });
    }
    
    // 제품명 입력
    const nameInput = card.querySelector('.name-input');
    if (nameInput) {
        let timeout;
        nameInput.addEventListener('input', function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                products[index].name = this.value;
            }, 1000);
        });
    }
    
    // 카테고리 선택
    const categorySelect = card.querySelector('.category-select');
    if (categorySelect) {
        categorySelect.addEventListener('change', function() {
            products[index].category = this.value;
        });
    }
    
    // 드래그 앤 드롭
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
    card.addEventListener('dragend', handleDragEnd);
    
    return card;
}

let draggedIndex = null;

function handleDragStart(e) {
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    const dropIndex = parseInt(this.dataset.index);
    
    if (draggedIndex !== dropIndex) {
        const temp = products[draggedIndex];
        products[draggedIndex] = products[dropIndex];
        products[dropIndex] = temp;
        
        products[draggedIndex].id = draggedIndex + 1;
        products[dropIndex].id = dropIndex + 1;
        
        renderProducts();
    }
    
    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => card.classList.remove('drag-over'));
}
