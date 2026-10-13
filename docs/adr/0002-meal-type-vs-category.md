# Món nước (phở/bún/nui) là một Kiểu bữa ăn riêng, không phải một Nhóm món

Khi thêm món nước kiểu phở/bún/nui vào ngân hàng món ăn, cách "hiển nhiên" là xếp chúng vào Nhóm món "Canh" có sẵn (vì cũng là món nước). Ta không làm vậy.

Trên thực tế không ai ăn phở/bún kèm xào và món mặn trong cùng một bữa — phở/bún/nui tự nó đã là một bữa hoàn chỉnh. Nếu xếp vào "Canh", thuật toán random 3-món/bữa sẽ tạo ra các bữa vô lý (vd: "Phở bò + Rau muống xào + Cá kho tộ").

Quyết định: thêm khái niệm **Kiểu bữa ăn** ở cấp cao hơn Nhóm món — **Bữa cơm 3 món** (mặc định, random 1 món/Nhóm món) và **Bữa 1 món** (chỉ 1 món, thay thế hoàn toàn cấu trúc 3 món). Xem [CONTEXT.md](../../CONTEXT.md).
